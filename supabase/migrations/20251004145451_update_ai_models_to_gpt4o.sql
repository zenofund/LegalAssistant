/*
  # Update AI Models to GPT-4o and GPT-4o-mini

  1. Changes
    - Update ai_model column default value to 'gpt-4o-mini'
    - Update Free tier: 'gpt-4o-mini' (cost-effective for free tier)
    - Update Pro tier: 'gpt-4o' (advanced model for paid users)
    - Update Enterprise tier: 'gpt-4o' (premium model with higher limits)

  2. Notes
    - Using latest OpenAI model identifiers (GPT-4o series)
    - Free tier gets gpt-4o-mini for cost efficiency
    - Pro and Enterprise tiers get gpt-4o for enhanced capabilities
    - This ensures correct model selection based on subscription tier
*/

-- Update default value for ai_model column
ALTER TABLE plans ALTER COLUMN ai_model SET DEFAULT 'gpt-4o-mini';

-- Update existing plans with new GPT-4o models
UPDATE plans
SET ai_model = CASE
  WHEN tier = 'free' THEN 'gpt-4o-mini'
  WHEN tier = 'pro' THEN 'gpt-4o'
  WHEN tier = 'enterprise' THEN 'gpt-4o'
  ELSE 'gpt-4o-mini'
END
WHERE ai_model IN ('gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4') OR ai_model IS NULL;

-- Verify the update
SELECT
  name,
  tier,
  ai_model,
  price,
  is_active
FROM plans
WHERE is_active = true
ORDER BY
  CASE tier
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'enterprise' THEN 3
  END;
