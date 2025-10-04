import { create } from 'zustand';
import { supabase, trackUsage } from '../lib/supabase';
import type { ChatMessage } from '../types/database';

interface ChatStore {
  currentSession: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  createNewSession: () => Promise<string>;
  loadSession: (sessionId: string) => Promise<void>;
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentSession: null,
  messages: [],
  isLoading: false,
  error: null,

  createNewSession: async () => {
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
        subscriptions (
          *,
          plan:plans (*)
        )
      `)
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Failed to load user profile');
    }

    // Check chat limits
    const currentPlan = profile.subscriptions?.[0]?.plan;
    if (currentPlan && currentPlan.max_chats_per_day !== -1) {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: usageData, error: usageError } = await supabase
        .from('usage_tracking')
        .select('count')
        .eq('user_id', user.id)
        .eq('feature', 'chat_message')
        .eq('date', today)
        .single();

      // Handle the case where no usage record exists for today (PGRST116 error)
      if (usageError && usageError.code !== 'PGRST116') {
        throw usageError;
      }
      
      const currentUsage = usageData?.count || 0;
      
      if (currentUsage >= currentPlan.max_chats_per_day) {
        throw new Error(`CHAT_LIMIT_REACHED:Daily chat limit reached (${currentPlan.max_chats_per_day} messages). Upgrade your plan for more messages.`);
      }
    }

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
        })
      });

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
        model_used: aiResponse.metadata?.model_used || 'gpt-3.5-turbo'
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

    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'An error occurred',
        isLoading: false
      });
      throw error;
    }
  },

  clearMessages: () => {
    set({ messages: [], currentSession: null });
  }
}));