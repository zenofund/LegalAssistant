/*
  # Add Missing Columns to Case Briefs Table
  
  1. Schema Updates
    - Add missing columns to case_briefs table for proper brief generation storage
    - brief_type: Type of brief (trial, appellate, memorandum, motion)
    - jurisdiction: Legal jurisdiction
    - case_number: Case number reference
    - parties_plaintiff: Plaintiff party name
    - parties_defendant: Defendant party name
    - introduction: Brief introduction section
    - statement_of_facts: Factual background section
    - issues_presented: Array of legal issues
    - legal_arguments: Main legal arguments section
    - analysis: Legal analysis section
    - conclusion: Conclusion section
    - prayer_for_relief: Relief requested
    - citations_used: Array of legal citations
    - draft_status: Whether brief is in draft status
    - ai_model_used: AI model used for generation
    - tokens_used: Token count for generation
    
  2. Data Migration
    - Safely add columns with appropriate defaults
    - Use IF NOT EXISTS to prevent errors on re-run
*/

-- Add brief_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'brief_type'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN brief_type text DEFAULT 'trial';
    ALTER TABLE case_briefs ADD CONSTRAINT case_briefs_brief_type_check 
      CHECK (brief_type IN ('trial', 'appellate', 'memorandum', 'motion'));
  END IF;
END $$;

-- Add jurisdiction column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'jurisdiction'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN jurisdiction text DEFAULT 'nigeria';
  END IF;
END $$;

-- Add case_number column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'case_number'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN case_number text;
  END IF;
END $$;

-- Add parties columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'parties_plaintiff'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN parties_plaintiff text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'parties_defendant'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN parties_defendant text;
  END IF;
END $$;

-- Add brief content columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'introduction'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN introduction text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'statement_of_facts'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN statement_of_facts text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'issues_presented'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN issues_presented text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'legal_arguments'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN legal_arguments text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'analysis'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN analysis text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'conclusion'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN conclusion text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'prayer_for_relief'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN prayer_for_relief text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'citations_used'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN citations_used text[] DEFAULT '{}';
  END IF;
END $$;

-- Add draft_status column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'draft_status'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN draft_status boolean DEFAULT true;
  END IF;
END $$;

-- Add metadata column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Add AI tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'ai_model_used'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN ai_model_used text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_briefs' AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE case_briefs ADD COLUMN tokens_used integer DEFAULT 0;
  END IF;
END $$;