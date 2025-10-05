/*
  # Update AI Models to GPT-5 Series

  1. Changes
    - Update ai_model column default value to 'gpt-4o-mini' (fallback model)
    - Update Free tier: 'gpt-5-nano' (cost-effective for free tier)
    - Update Pro tier: 'gpt-5-mini' (balanced performance for paid users)
    - Update Enterprise tier: 'gpt-5' (premium model with highest capabilities)

  2. Notes
    - Using latest GPT-5 model identifiers
    - Free tier gets gpt-5-nano for cost efficiency while providing GPT-5 capabilities
    - Pro tier gets gpt-5-mini for enhanced performance
    - Enterprise tier gets full gpt-5 for maximum capabilities
    - Fallback model remains gpt-4o-mini for reliability
    - This ensures correct model selection based on subscription tier
*/

-- Update default value for ai_model column to use gpt-4o-mini as fallback
ALTER TABLE plans ALTER COLUMN ai_model SET DEFAULT 'gpt-4o-mini';

-- Update existing plans with new GPT-5 models
UPDATE plans
SET ai_model = CASE
  WHEN tier = 'free' THEN 'gpt-5-nano'
  WHEN tier = 'pro' THEN 'gpt-5-mini'
  WHEN tier = 'enterprise' THEN 'gpt-5'
  ELSE 'gpt-4o-mini'
END
WHERE ai_model IN ('gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4', 'gpt-4o', 'gpt-4o-mini') OR ai_model IS NULL;

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
