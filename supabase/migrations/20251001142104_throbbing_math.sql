/*
  # Seed Data for easyAI

  1. Subscription Plans
    - Free tier with basic features
    - Pro tier with advanced features
    - Enterprise tier with full features

  2. Sample Documents
    - Nigerian legal cases and statutes
    - Practice notes and templates

  3. Admin User
    - Default super admin account
*/

-- Insert subscription plans
INSERT INTO plans (id, name, tier, features, price, billing_cycle, max_documents, max_chats_per_day, internet_search, ai_drafting, collaboration) VALUES
(
  gen_random_uuid(),
  'Free Plan',
  'free',
  '{
    "chat_with_ai": true,
    "document_upload": true,
    "basic_search": true,
    "chat_history": true,
    "max_documents": 10,
    "max_chats_per_day": 50,
    "support": "community"
  }'::jsonb,
  0.00,
  'monthly',
  10,
  50,
  false,
  false,
  false
),
(
  gen_random_uuid(),
  'Pro Plan',
  'pro',
  '{
    "chat_with_ai": true,
    "document_upload": true,
    "advanced_search": true,
    "internet_search": true,
    "case_summarizer": true,
    "citation_generator": true,
    "legal_brief_generator": true,
    "case_comparison": true,
    "statute_navigator": true,
    "export_functionality": true,
    "max_documents": 500,
    "max_chats_per_day": 1000,
    "support": "email"
  }'::jsonb,
  15000.00,
  'monthly',
  500,
  1000,
  true,
  false,
  false
),
(
  gen_random_uuid(),
  'Enterprise Plan',
  'enterprise',
  '{
    "chat_with_ai": true,
    "document_upload": true,
    "advanced_search": true,
    "internet_search": true,
    "case_summarizer": true,
    "citation_generator": true,
    "legal_brief_generator": true,
    "case_comparison": true,
    "statute_navigator": true,
    "export_functionality": true,
    "precedent_tracking": true,
    "statute_evolution": true,
    "team_collaboration": true,
    "ai_document_drafting": true,
    "analytics_dashboard": true,
    "white_label": true,
    "voice_input": true,
    "offline_access": true,
    "unlimited_documents": true,
    "unlimited_chats": true,
    "support": "priority"
  }'::jsonb,
  50000.00,
  'monthly',
  -1,
  -1,
  true,
  true,
  true
);

-- Insert sample legal documents
INSERT INTO documents (title, type, content, metadata, jurisdiction, year, citation, tags) VALUES
(
  'Nigerian Constitution 1999 (as amended)',
  'statute',
  'The Constitution of the Federal Republic of Nigeria 1999 is the supreme law of Nigeria. It provides the framework for the organization of government and guarantees certain fundamental rights to citizens.',
  '{
    "court": "National Assembly",
    "summary": "Supreme law of Nigeria establishing government structure and fundamental rights",
    "key_provisions": ["Fundamental Rights", "Federal Structure", "Separation of Powers"],
    "amendments": ["2010", "2018"]
  }'::jsonb,
  'nigeria',
  1999,
  '1999 Constitution',
  ARRAY['constitution', 'fundamental rights', 'federal structure']
),
(
  'Companies and Allied Matters Act 2020',
  'statute',
  'The Companies and Allied Matters Act 2020 (CAMA 2020) is the principal legislation governing company law in Nigeria. It repealed the Companies and Allied Matters Act 1990.',
  '{
    "summary": "Principal company law legislation in Nigeria",
    "key_provisions": ["Company Formation", "Corporate Governance", "Winding Up"],
    "changes_from_previous": "Introduced electronic filing, small company regime"
  }'::jsonb,
  'nigeria',
  2020,
  'CAMA 2020',
  ARRAY['company law', 'corporate governance', 'business']
),
(
  'Carlill v. Carbolic Smoke Ball Company',
  'case',
  'A landmark English contract law case establishing principles of unilateral contracts and consideration. Frequently cited in Nigerian courts for contract law principles.',
  '{
    "court": "Court of Appeal (England)",
    "judges": ["Lord Justice Lindley", "Lord Justice Bowen", "Lord Justice A.L. Smith"],
    "facts": "Advertisement for smoke ball with £100 reward",
    "legal_principle": "Unilateral contract formation and adequacy of consideration",
    "ratio": "An advertisement can constitute a valid offer capable of acceptance",
    "obiter": "Discussion on consideration in unilateral contracts"
  }'::jsonb,
  'england',
  1893,
  '[1893] 1 QB 256',
  ARRAY['contract law', 'unilateral contract', 'consideration', 'offer and acceptance']
),
(
  'Practice Note: Filing Requirements for Federal High Court',
  'practice_note',
  'This practice note outlines the procedural requirements for filing documents at the Federal High Court of Nigeria, including fees, formatting requirements, and timelines.',
  '{
    "court": "Federal High Court",
    "effective_date": "2023-01-01",
    "key_requirements": ["Electronic filing mandatory", "Specific formatting rules", "Filing fees schedule"]
  }'::jsonb,
  'nigeria',
  2023,
  'FHC Practice Note 2023/1',
  ARRAY['practice note', 'federal high court', 'procedure', 'filing']
);

-- Insert sample admin notifications
INSERT INTO admin_notifications (title, message, type, target_roles) VALUES
(
  'Welcome to easyAI',
  'Welcome to easyAI - your AI-powered legal research assistant. Start by uploading documents or asking legal questions.',
  'info',
  ARRAY['user']
),
(
  'System Maintenance',
  'Scheduled maintenance will occur on Sundays from 2:00 AM to 4:00 AM WAT. Please plan accordingly.',
  'warning',
  ARRAY['user']
);

-- Create default free plan subscription function
CREATE OR REPLACE FUNCTION assign_free_plan_to_new_user()
RETURNS trigger AS $$
DECLARE
  free_plan_id uuid;
BEGIN
  -- Get the free plan ID
  SELECT id INTO free_plan_id FROM plans WHERE tier = 'free' LIMIT 1;
  
  -- Create subscription for new user
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO subscriptions (user_id, plan_id, status, start_date)
    VALUES (NEW.id, free_plan_id, 'active', now());
    
    -- Update user's subscription_id
    UPDATE users SET subscription_id = (
      SELECT id FROM subscriptions WHERE user_id = NEW.id ORDER BY created_at DESC LIMIT 1
    ) WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically assign free plan to new users
CREATE TRIGGER assign_free_plan_trigger
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION assign_free_plan_to_new_user();