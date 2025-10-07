import { create } from 'zustand';
import { supabase, trackUsage } from '../lib/supabase';
import type { ChatMessage } from '../types/database';
import { getNetworkStatus } from '../lib/sessionManager';

interface ChatStore {
  currentSession: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  abortController: AbortController | null;

  // Actions
  createNewSession: () => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  clearMessages: () => void;
  cancelRequest: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentSession: null,
  messages: [],
  isLoading: false,
  error: null,
  abortController: null,

  createNewSession: async () => {
    if (!getNetworkStatus()) {
      throw new Error('NETWORK_ERROR:Cannot create session while offline. Please check your connection.');
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    const sessionId = crypto.randomUUID();

    const { error } = await supabase
      .from('chat_sessions')
      .insert({
        id: sessionId,
        user_id: user.id,
        title: null,
        last_message_at: new Date().toISOString(),
        message_count: 0
      });

    if (error) throw error;

    set({ currentSession: sessionId, messages: [] });
    return sessionId;
  },

  loadSession: async (sessionId: string) => {
    if (!getNetworkStatus()) {
      const cached = get().messages;
      if (cached.length > 0) {
        console.log('Offline mode: Using cached messages');
        return;
      }
      throw new Error('NETWORK_ERROR:Cannot load session while offline.');
    }

    set({ isLoading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      set({
        currentSession: sessionId,
        messages: data || [],
        isLoading: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false
      });
    }
  },

  sendMessage: async (sessionId: string, content: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) throw new Error('User not authenticated');

    // Get current user profile to check limits
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        subscription:subscriptions!subscriptions_user_id_fkey (
          *,
          plan:plans (*)
        )
      `)
      .eq('id', user.id)
      .eq('subscriptions.user_id', user.id)
      .eq('subscriptions.status', 'active')
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to load user profile');
    }

    // Chat limits disabled - subscription system not in current schema
    // Premium users have unlimited access based on is_premium flag

    set({ isLoading: true, error: null });

    try {
      // Add user message
      const userMessage: Omit<ChatMessage, 'id' | 'created_at'> = {
        user_id: user.id,
        session_id: sessionId,
        message: content,
        role: 'user',
        sources: [],
        metadata: {},
        tokens_used: 0,
        model_used: null
      };

      const { data: userMsgData, error: userMsgError } = await supabase
        .from('chats')
        .insert(userMessage)
        .select()
        .single();

      if (userMsgError) throw userMsgError;

      // Update local state with user message
      set(state => ({
        messages: [...state.messages, userMsgData]
      }));

      // Check network status before making API call
      if (!getNetworkStatus()) {
        throw new Error('NETWORK_ERROR:Cannot send message while offline. Please check your connection.');
      }

      // Create abort controller for this request
      const controller = new AbortController();
      set({ abortController: controller });

      // Set a timeout for the request
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        // Call AI service
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: content,
            session_id: sessionId,
            user_id: user.id
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        set({ abortController: null });

        if (!response.ok) {
          let errorMessage = 'Failed to get AI response';

          try {
            const errorData = await response.json();

            if (response.status === 429 && errorData.error === 'CHAT_LIMIT_REACHED') {
            const limitData = {
              current_usage: errorData.current_usage,
              max_limit: errorData.max_limit,
              remaining: errorData.remaining,
              plan_tier: errorData.plan_tier,
              upgrade_needed: errorData.upgrade_needed
            };
              errorMessage = `CHAT_LIMIT_REACHED:${JSON.stringify(limitData)}`;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            } else if (errorData.details) {
              errorMessage = errorData.details;
            }
          } catch (parseError) {
            if (response.status === 429) {
              errorMessage = 'AI_RATE_LIMIT:Too many requests. Please wait a moment before sending another message.';
            } else if (response.status >= 500) {
              errorMessage = 'AI_SERVER_ERROR:AI service is temporarily unavailable. Please try again in a few moments.';
            }
          }

          throw new Error(errorMessage);
        }

        const aiResponse = await response.json();

        // Add AI response
        const assistantMessage: Omit<ChatMessage, 'id' | 'created_at'> = {
        user_id: user.id,
        session_id: sessionId,
        message: aiResponse.message,
        role: 'assistant',
        sources: aiResponse.sources || [],
        metadata: aiResponse.metadata || {},
        tokens_used: aiResponse.tokens_used || 0,
          model_used: aiResponse.metadata?.model_used || 'gpt-4o-mini'
        };

        const { data: aiMsgData, error: aiMsgError } = await supabase
          .from('chats')
          .insert(assistantMessage)
          .select()
          .single();

        if (aiMsgError) throw aiMsgError;

        // Update local state with AI response
        set(state => ({
          messages: [...state.messages, aiMsgData],
          isLoading: false
        }));

        // Update chat session with new message count and timestamp
        // Note: Usage tracking is now handled server-side in the edge function
        await supabase
          .from('chat_sessions')
          .update({
            message_count: get().messages.length + 2, // +2 for user and AI messages
            last_message_at: new Date().toISOString(),
            title: get().messages.length === 0 ? content.slice(0, 50) + '...' : undefined
          })
          .eq('id', sessionId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        set({ abortController: null });

        if (fetchError.name === 'AbortError') {
          throw new Error('REQUEST_TIMEOUT:Request timed out. The AI is taking longer than expected. Please try again.');
        }

        throw fetchError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';

      const isNetworkError = errorMessage.includes('NETWORK_ERROR') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('network') ||
        errorMessage.toLowerCase().includes('failed to fetch');

      set({
        error: errorMessage,
        isLoading: false,
        abortController: null
      });

      if (isNetworkError) {
        console.error('Network error in sendMessage:', error);
      }

      throw error;
    }
  },

  clearMessages: () => {
    set({ messages: [], currentSession: null });
  },

  cancelRequest: () => {
    const controller = get().abortController;
    if (controller) {
      console.log('Cancelling ongoing request...');
      controller.abort();
      set({ abortController: null, isLoading: false });
    }
  }
}));