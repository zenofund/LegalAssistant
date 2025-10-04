/*
  # Create AI Drafts Table and Feature Limits
  
  1. New Tables
    - `ai_drafts`: Store AI-generated legal document drafts
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `document_type` (text: contract, pleading, motion, letter, memorandum)
      - `title` (text)
      - `content` (text, the generated draft)
      - `parameters` (jsonb, input parameters used)
      - `version` (integer, for version control)
      - `parent_draft_id` (uuid, for tracking versions)
      - `is_finalized` (boolean)
      - `metadata` (jsonb)
      - `ai_model_used` (text)
      - `tokens_used` (integer)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Schema Updates
    - Add feature limit columns to plans table for Pro tier restrictions
    - max_summaries_per_day: Daily limit for case summarizer (default 20 for Pro)
    - max_citations_per_day: Daily limit for citation generator (default 20 for Pro)
    - max_briefs_per_day: Daily limit for brief generator (default 20 for Pro)
  
  3. Security
    - Enable RLS on ai_drafts table
    - Add policies for users to manage their own drafts
*/

-- Create ai_drafts table
CREATE TABLE IF NOT EXISTS ai_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('contract', 'pleading', 'motion', 'letter', 'memorandum', 'other')),
  title text NOT NULL,
  content text NOT NULL,
  parameters jsonb DEFAULT '{}',
  version integer DEFAULT 1,
  parent_draft_id uuid REFERENCES ai_drafts(id) ON DELETE SET NULL,
  is_finalized boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  ai_model_used text,
  tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add feature limit columns to plans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'max_summaries_per_day'
  ) THEN
    ALTER TABLE plans ADD COLUMN max_summaries_per_day integer DEFAULT -1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'max_citations_per_day'
  ) THEN
    ALTER TABLE plans ADD COLUMN max_citations_per_day integer DEFAULT -1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'max_briefs_per_day'
  ) THEN
    ALTER TABLE plans ADD COLUMN max_briefs_per_day integer DEFAULT -1;
  END IF;
END $$;

-- Update existing Pro plan to have limits of 20/day for these features
UPDATE plans 
SET 
  max_summaries_per_day = 20,
  max_citations_per_day = 20,
  max_briefs_per_day = 20
WHERE tier = 'pro' AND max_summaries_per_day = -1;

-- Enable RLS on ai_drafts
ALTER TABLE ai_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_drafts
CREATE POLICY "Users can view own drafts"
  ON ai_drafts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own drafts"
  ON ai_drafts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts"
  ON ai_drafts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts"
  ON ai_drafts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_drafts_user_id ON ai_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_document_type ON ai_drafts(document_type);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_parent_draft_id ON ai_drafts(parent_draft_id);
CREATE INDEX IF NOT EXISTS idx_ai_drafts_created_at ON ai_drafts(created_at DESC);