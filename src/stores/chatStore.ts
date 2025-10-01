import { create } from 'zustand';
import { supabase } from '../lib/supabase';
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
        throw new Error('Failed to get AI response');
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
        model_used: aiResponse.model_used || 'gpt-4'
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