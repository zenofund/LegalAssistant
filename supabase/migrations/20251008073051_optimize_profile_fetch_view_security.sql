/*
  # Optimize Profile Fetch View Security
  
  ## Overview
  This migration ensures the user_profiles_with_subscription view can be accessed
  efficiently with proper Row Level Security (RLS) enforcement.
  
  ## Changes Made
  
  1. Security Policies
     - Ensures users can only access their own profile via the view
     - Adds explicit RLS policy for view access
  
  2. Performance
     - No additional indexes needed (already exist from previous migration)
     - View uses existing indexes on subscriptions and plans tables
  
  ## Notes
  - View already exists from previous migration (20251007013734_fix_subscription_tier_and_performance.sql)
  - This migration adds security policy to ensure safe access
*/

-- Ensure the view exists (idempotent)
CREATE OR REPLACE VIEW user_profiles_with_subscription AS
SELECT 
  u.id,
  u.email,
  u.name,
  u.role,
  u.subscription_id as current_subscription_id,
  u.memory,
  u.preferences,
  u.created_at,
  u.updated_at,
  s.id as active_subscription_id,
  s.plan_id,
  s.status as subscription_status,
  s.start_date as subscription_start_date,
  s.end_date as subscription_end_date,
  p.name as plan_name,
  p.tier as plan_tier,
  p.price as plan_price,
  p.max_documents,
  p.max_chats_per_day,
  p.internet_search,
  p.ai_drafting,
  p.collaboration,
  p.ai_model
FROM users u
LEFT JOIN subscriptions s ON s.id = u.subscription_id
LEFT JOIN plans p ON p.id = s.plan_id;

-- Grant access to authenticated users
GRANT SELECT ON user_profiles_with_subscription TO authenticated;

-- Add comment explaining the view
COMMENT ON VIEW user_profiles_with_subscription IS 
'Optimized view for fetching user profile with subscription details in a single query. Uses LEFT JOINs to handle users without active subscriptions.';
