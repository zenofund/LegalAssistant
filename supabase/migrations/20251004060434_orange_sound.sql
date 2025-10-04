/*
  # Update Pro Tier Features

  1. Enhanced Features
    - Enable internet search for Pro tier
    - Add Legal Citation Generator (NWLR, FWLR styles)
    - Add Case Summarizer (facts, issues, ratio/obiter)
    - Update features JSONB with detailed capabilities

  2. Changes
    - Set internet_search = true for Pro plan
    - Update features JSONB with new capabilities
    - Ensure Pro tier has comprehensive legal research tools
*/

-- Update the Pro plan to include new features
UPDATE plans 
SET 
  internet_search = true,
  features = jsonb_set(
    jsonb_set(
      jsonb_set(
        features,
        '{internet_search}',
        'true'::jsonb
      ),
      '{legal_citation_generator}',
      '{"enabled": true, "formats": ["NWLR", "FWLR", "Custom"], "auto_format": true}'::jsonb
    ),
    '{case_summarizer}',
    '{"enabled": true, "components": ["facts", "issues", "ratio", "obiter"], "ai_powered": true}'::jsonb
  ),
  updated_at = now()
WHERE tier = 'pro' AND is_active = true;

-- Verify the update
SELECT 
  name,
  tier,
  internet_search,
  features->'internet_search' as internet_search_feature,
  features->'legal_citation_generator' as citation_generator,
  features->'case_summarizer' as case_summarizer
FROM plans 
WHERE tier = 'pro' AND is_active = true;