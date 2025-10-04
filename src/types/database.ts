export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: 'user' | 'admin' | 'super_admin';
          subscription_id: string | null;
          memory: Record<string, any>;
          preferences: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          role?: 'user' | 'admin' | 'super_admin';
          subscription_id?: string | null;
          memory?: Record<string, any>;
          preferences?: Record<string, any>;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: 'user' | 'admin' | 'super_admin';
          subscription_id?: string | null;
          memory?: Record<string, any>;
          preferences?: Record<string, any>;
        };
      };
      plans: {
        Row: {
          id: string;
          name: string;
          tier: 'free' | 'pro' | 'enterprise';
          features: Record<string, any>;
          price: number;
          billing_cycle: 'monthly' | 'yearly';
          split_account: string | null;
          max_documents: number;
          max_chats_per_day: number;
          internet_search: boolean;
          ai_drafting: boolean;
          collaboration: boolean;
          ai_model: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          tier: 'free' | 'pro' | 'enterprise';
          features?: Record<string, any>;
          price?: number;
          billing_cycle?: 'monthly' | 'yearly';
          split_account?: string | null;
          max_documents?: number;
          max_chats_per_day?: number;
          internet_search?: boolean;
          ai_drafting?: boolean;
          collaboration?: boolean;
          ai_model?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          tier?: 'free' | 'pro' | 'enterprise';
          features?: Record<string, any>;
          price?: number;
          billing_cycle?: 'monthly' | 'yearly';
          split_account?: string | null;
          max_documents?: number;
          max_chats_per_day?: number;
          internet_search?: boolean;
          ai_drafting?: boolean;
          collaboration?: boolean;
          ai_model?: string;
          is_active?: boolean;
        };
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: 'active' | 'cancelled' | 'expired' | 'pending';
          start_date: string;
          end_date: string | null;
          paystack_subscription_code: string | null;
          paystack_customer_code: string | null;
          auto_renew: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: 'active' | 'cancelled' | 'expired' | 'pending';
          start_date?: string;
          end_date?: string | null;
          paystack_subscription_code?: string | null;
          paystack_customer_code?: string | null;
          auto_renew?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: 'active' | 'cancelled' | 'expired' | 'pending';
          start_date?: string;
          end_date?: string | null;
          paystack_subscription_code?: string | null;
          paystack_customer_code?: string | null;
          auto_renew?: boolean;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          amount: number;
          currency: string;
          paystack_tx_ref: string | null;
          paystack_access_code: string | null;
          split_info: Record<string, any> | null;
          status: 'pending' | 'success' | 'failed' | 'abandoned';
          payment_method: string | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          amount: number;
          currency?: string;
          paystack_tx_ref?: string | null;
          paystack_access_code?: string | null;
          split_info?: Record<string, any> | null;
          status?: 'pending' | 'success' | 'failed' | 'abandoned';
          payment_method?: string | null;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string | null;
          amount?: number;
          currency?: string;
          paystack_tx_ref?: string | null;
          paystack_access_code?: string | null;
          split_info?: Record<string, any> | null;
          status?: 'pending' | 'success' | 'failed' | 'abandoned';
          payment_method?: string | null;
          metadata?: Record<string, any>;
        };
      };
      documents: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          type: 'case' | 'statute' | 'regulation' | 'practice_note' | 'template';
          file_url: string | null;
          file_size: number | null;
          content: string | null;
          embeddings: number[] | null;
          metadata: Record<string, any>;
          jurisdiction: string;
          year: number | null;
          citation: string | null;
          tags: string[];
          is_public: boolean;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          type: 'case' | 'statute' | 'regulation' | 'practice_note' | 'template';
          file_url?: string | null;
          file_size?: number | null;
          content?: string | null;
          embeddings?: number[] | null;
          metadata?: Record<string, any>;
          jurisdiction?: string;
          year?: number | null;
          citation?: string | null;
          tags?: string[];
          is_public?: boolean;
          uploaded_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          type?: 'case' | 'statute' | 'regulation' | 'practice_note' | 'template';
          file_url?: string | null;
          file_size?: number | null;
          content?: string | null;
          embeddings?: number[] | null;
          metadata?: Record<string, any>;
          jurisdiction?: string;
          year?: number | null;
          citation?: string | null;
          tags?: string[];
          is_public?: boolean;
          uploaded_by?: string | null;
        };
      };
      chats: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          message: string;
          role: 'user' | 'assistant' | 'system';
          sources: Record<string, any>[];
          metadata: Record<string, any>;
          tokens_used: number;
          model_used: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          message: string;
          role: 'user' | 'assistant' | 'system';
          sources?: Record<string, any>[];
          metadata?: Record<string, any>;
          tokens_used?: number;
          model_used?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          message?: string;
          role?: 'user' | 'assistant' | 'system';
          sources?: Record<string, any>[];
          metadata?: Record<string, any>;
          tokens_used?: number;
          model_used?: string | null;
        };
      };
      chat_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          last_message_at: string;
          message_count: number;
          is_archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          last_message_at?: string;
          message_count?: number;
          is_archived?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string | null;
          last_message_at?: string;
          message_count?: number;
          is_archived?: boolean;
        };
      };
      admin_notifications: {
        Row: {
          id: string;
          title: string;
          message: string;
          type: 'info' | 'warning' | 'error' | 'success';
          target_roles: string[];
          is_active: boolean;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          message: string;
          type?: 'info' | 'warning' | 'error' | 'success';
          target_roles?: string[];
          is_active?: boolean;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          message?: string;
          type?: 'info' | 'warning' | 'error' | 'success';
          target_roles?: string[];
          is_active?: boolean;
          expires_at?: string | null;
        };
      };
      usage_tracking: {
        Row: {
          id: string;
          user_id: string;
          feature: string;
          count: number;
          date: string;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature: string;
          count?: number;
          date?: string;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          user_id?: string;
          feature?: string;
          count?: number;
          date?: string;
          metadata?: Record<string, any>;
        };
      };
    };
  };
}

export interface ChatMessage {
  id: string;
  user_id: string;
  session_id: string;
  message: string;
  role: 'user' | 'assistant' | 'system';
  sources: DocumentSource[];
  metadata: Record<string, any>;
  tokens_used: number;
  model_used: string | null;
  created_at: string;
}

export interface DocumentSource {
  id: string;
  title: string;
  type: string;
  citation?: string;
  page?: number;
  relevance_score: number;
  excerpt: string;
}

export interface Plan {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  features: Record<string, any>;
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  max_documents: number;
  max_chats_per_day: number;
  internet_search: boolean;
  ai_drafting: boolean;
  collaboration: boolean;
  ai_model: string;
}

export type UserProfile = Database['public']['Tables']['users']['Row'] & {
  subscription?: Database['public']['Tables']['subscriptions']['Row'] & {
    plan: Plan;
  };
};