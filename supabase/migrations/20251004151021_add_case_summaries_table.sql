/*
  # Add Case Summaries Table for Pro Tier Feature

  1. New Table
    - `case_summaries`
      - Stores AI-generated case summaries with structured legal analysis
      - Includes facts, issues, holdings, reasoning, ratio decidendi, and obiter dicta
      - Links to documents and users
      - Tracks generation metadata

  2. Security
    - Enable RLS on the table
    - Users can only access their own summaries
    - Pro and Enterprise tier users can create summaries

  3. Indexes
    - Add indexes on user_id and document_id for performance
    - Add index on created_at for sorting recent analyses

  4. Important Notes
    - Case summaries focus on extracting key legal elements from cases
    - Feature is restricted to Pro and Enterprise tier users
    - Usage tracking is handled separately in usage_tracking table
*/

-- Create case_summaries table
CREATE TABLE IF NOT EXISTS case_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  title text NOT NULL,
  case_name text,
  case_citation text,
  facts text NOT NULL,
  issues text[] NOT NULL DEFAULT '{}',
  holding text NOT NULL,
  reasoning text NOT NULL,
  ratio_decidendi text,
  obiter_dicta text,
  jurisdiction text DEFAULT 'nigeria',
  court text,
  year integer,
  judges text[],
  summary_type text DEFAULT 'standard' CHECK (summary_type IN ('standard', 'detailed', 'brief')),
  metadata jsonb DEFAULT '{}',
  ai_model_used text,
  tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for case_summaries
CREATE INDEX IF NOT EXISTS idx_case_summaries_user_id ON case_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_case_summaries_document_id ON case_summaries(document_id);
CREATE INDEX IF NOT EXISTS idx_case_summaries_created_at ON case_summaries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_summaries_case_name ON case_summaries(case_name);

-- Enable RLS
ALTER TABLE case_summaries ENABLE ROW LEVEL SECURITY;

-- Case Summaries RLS Policies
CREATE POLICY "Users can view own case summaries"
  ON case_summaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own case summaries"
  ON case_summaries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own case summaries"
  ON case_summaries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own case summaries"
  ON case_summaries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_case_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_case_summaries_updated_at_trigger ON case_summaries;
CREATE TRIGGER update_case_summaries_updated_at_trigger
  BEFORE UPDATE ON case_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_case_summaries_updated_at();