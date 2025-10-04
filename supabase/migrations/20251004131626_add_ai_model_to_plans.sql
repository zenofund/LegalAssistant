/*
  # Add AI Model Configuration to Plans

  1. Changes
    - Add `ai_model` column to plans table to store the GPT model tier for each subscription plan
    - Update existing plans with appropriate model assignments:
      - Free tier: gpt-3.5-turbo (most cost-effective for free tier)
      - Pro tier: gpt-4-turbo (balanced performance)
      - Enterprise tier: gpt-4 (premium model)
    
  2. Notes
    - Using standard OpenAI model names for compatibility
    - Model names can be updated as new models become available
    - This enables dynamic model selection based on subscription tier
*/

-- Add ai_model column to plans table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plans' AND column_name = 'ai_model'
  ) THEN
    ALTER TABLE plans ADD COLUMN ai_model text DEFAULT 'gpt-3.5-turbo';
  END IF;
END $$;

-- Update existing plans with appropriate models based on tier
UPDATE plans 
SET ai_model = CASE 
  WHEN tier = 'free' THEN 'gpt-3.5-turbo'
  WHEN tier = 'pro' THEN 'gpt-4-turbo'
  WHEN tier = 'enterprise' THEN 'gpt-4'
  ELSE 'gpt-3.5-turbo'
END
WHERE ai_model = 'gpt-3.5-turbo' OR ai_model IS NULL;
