/*
  # easyAI Initial Database Schema (Clean & Corrected)

  1. Core Tables
    - users
    - plans
    - subscriptions
    - transactions
    - documents
    - chats
    - chat_sessions
    - admin_notifications
    - usage_tracking

  2. Security
    - Row Level Security (RLS) enabled on all tables
    - Role-based access policies

  3. Indexes
    - Optimized for retrieval, subscriptions, transactions, and embeddings

  4. Triggers
    - Auto-update updated_at
    - Auto-update chat session stats
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ======================
-- USERS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  subscription_id uuid,
  memory jsonb DEFAULT '{}',
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ======================
-- PLANS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  tier text NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
  features jsonb NOT NULL DEFAULT '{}',
  price decimal(10,2) DEFAULT 0,
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  split_account text,
  max_documents integer DEFAULT 10,
  max_chats_per_day integer DEFAULT 50,
  internet_search boolean DEFAULT false,
  ai_drafting boolean DEFAULT false,
  collaboration boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ======================
-- SUBSCRIPTIONS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE RESTRICT,
  status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  paystack_subscription_code text,
  paystack_customer_code text,
  auto_renew boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ======================
-- TRANSACTIONS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'NGN',
  paystack_tx_ref text UNIQUE,
  paystack_access_code text,
  split_info jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
  payment_method text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ======================
-- DOCUMENTS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('case', 'statute', 'regulation', 'practice_note', 'template')),
  file_url text,
  file_size bigint,
  content text,
  embeddings vector(1536),
  metadata jsonb DEFAULT '{}',
  jurisdiction text DEFAULT 'nigeria',
  year integer,
  citation text,
  tags text[],
  is_public boolean DEFAULT true,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ======================
-- CHATS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  message text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  sources jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  tokens_used integer DEFAULT 0,
  model_used text,
  created_at timestamptz DEFAULT now()
);

-- ======================
-- CHAT SESSIONS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text,
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ======================
-- ADMIN NOTIFICATIONS TABLE
-- ======================
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  target_roles text[] DEFAULT ARRAY['user'],
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- ======================
-- USAGE TRACKING TABLE
-- ======================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  count integer DEFAULT 1,
  date date DEFAULT CURRENT_DATE,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, feature, date)
);

-- ======================
-- ENABLE RLS
-- ======================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- ======================
-- POLICIES
-- ======================

-- Users
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can read all users" ON users
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "Admins can update users" ON users
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Plans
CREATE POLICY "Plans are publicly readable" ON plans
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON plans
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Subscriptions
CREATE POLICY "Users can read own subscriptions" ON subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can read all subscriptions" ON subscriptions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "System can manage subscriptions" ON subscriptions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Transactions
CREATE POLICY "Users can read own transactions" ON transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can read all transactions" ON transactions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

CREATE POLICY "System can insert transactions" ON transactions
  FOR INSERT TO authenticated WITH CHECK (true);

-- Documents
CREATE POLICY "Public documents are readable" ON documents
  FOR SELECT TO authenticated USING (is_public = true);

CREATE POLICY "Admins can manage all documents" ON documents
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Chats
CREATE POLICY "Users can read own chats" ON chats
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own chats" ON chats
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all chats" ON chats
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Chat sessions
CREATE POLICY "Users can manage own chat sessions" ON chat_sessions
  FOR ALL TO authenticated USING (user_id = auth.uid());

-- Admin notifications
CREATE POLICY "Users can read relevant notifications" ON admin_notifications
  FOR SELECT TO authenticated USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      target_roles @> ARRAY[(SELECT role FROM users WHERE id = auth.uid() LIMIT 1)]
      OR target_roles @> ARRAY['all']
    )
  );

CREATE POLICY "Admins can manage notifications" ON admin_notifications
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- Usage tracking
CREATE POLICY "Users can read own usage" ON usage_tracking
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "System can track usage" ON usage_tracking
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can update usage" ON usage_tracking
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ======================
-- INDEXES
-- ======================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_paystack_ref ON transactions(paystack_tx_ref);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
CREATE INDEX IF NOT EXISTS idx_documents_embeddings ON documents USING ivfflat (embeddings vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chats_user_session ON chats(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_date ON usage_tracking(user_id, date);

-- ======================
-- TRIGGERS
-- ======================

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Chat session stats trigger
CREATE OR REPLACE FUNCTION update_chat_session_stats()
RETURNS trigger AS $$
BEGIN
  UPDATE chat_sessions 
  SET 
    message_count = (
      SELECT COUNT(*) FROM chats WHERE session_id = NEW.session_id
    ),
    last_message_at = NEW.created_at,
    title = CASE 
      WHEN title IS NULL AND NEW.role = 'user' THEN 
        LEFT(NEW.message, 50) || CASE WHEN LENGTH(NEW.message) > 50 THEN '...' ELSE '' END
      ELSE title
    END
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_session_on_message
  AFTER INSERT ON chats
  FOR EACH ROW EXECUTE FUNCTION update_chat_session_stats();
