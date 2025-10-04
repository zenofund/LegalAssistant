/*
  # Create Feedback and Sharing Tables
  
  1. New Tables
    - `message_feedback`: Store thumbs up/down feedback for chat messages
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `message_id` (uuid, foreign key to chats)
      - `feedback_type` (text: 'positive' or 'negative')
      - `feedback_text` (text, optional additional feedback)
      - `created_at` (timestamptz)
    
    - `shared_conversations`: Store shared chat sessions with public access
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to chat_sessions)
      - `user_id` (uuid, foreign key to users)
      - `share_token` (text, unique token for public access)
      - `is_active` (boolean, whether share is still active)
      - `expires_at` (timestamptz, optional expiration)
      - `view_count` (integer, track how many times viewed)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own feedback
    - Add policies for shared conversations with public read access
*/

-- Create message_feedback table
CREATE TABLE IF NOT EXISTS message_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  feedback_type text NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  feedback_text text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Create shared_conversations table
CREATE TABLE IF NOT EXISTS shared_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  view_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_feedback
CREATE POLICY "Users can view own feedback"
  ON message_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own feedback"
  ON message_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
  ON message_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
  ON message_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for shared_conversations
CREATE POLICY "Users can view own shares"
  ON shared_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shares"
  ON shared_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shares"
  ON shared_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shares"
  ON shared_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Public can view active shared conversations (for share feature)
CREATE POLICY "Anyone can view active shared conversations"
  ON shared_conversations FOR SELECT
  TO public
  USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_shared_conversations_share_token ON shared_conversations(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_conversations_session_id ON shared_conversations(session_id);