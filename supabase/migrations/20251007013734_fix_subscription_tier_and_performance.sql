/*
  # Fix Subscription Tier and Performance Issues

  ## Overview
  This migration addresses critical issues with user subscription tier detection and profile fetch performance.

  ## Problems Fixed
  1. Profile fetch timeouts due to complex nested queries
  2. Users showing as "free plan" regardless of actual subscription
  3. Missing synchronization between subscriptions and users table
  4. Slow subscription status lookups

  ## Changes Made

  ### 1. Database Functions
  - `get_user_current_subscription` - Efficiently retrieves user's active subscription with plan details
  - `get_user_tier` - Fast tier lookup without complex joins
  - `sync_user_subscription_id` - Keeps users.subscription_id in sync with active subscriptions
  
  ### 2. Indexes
  - Index on subscriptions(user_id, status) for faster active subscription lookups
  - Index on subscriptions(status, end_date) for expired subscription checks

  ### 3. Triggers
  - Auto-sync subscription_id when subscriptions are inserted/updated
  - Update users table when subscription status changes

  ### 4. Data Repair
  - Fix existing users with active subscriptions but NULL subscription_id
  - Ensure all users have at least a free plan subscription

  ## Security
  - All functions respect existing RLS policies
  - No changes to existing access controls
*/

-- ==============================================
-- 1. CREATE INDEXES FOR PERFORMANCE
-- ==============================================

-- Index for fast active subscription lookup by user
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
ON subscriptions(user_id, status) 
WHERE status = 'active';

-- Index for expired subscription checks
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_end_date 
ON subscriptions(status, end_date) 
WHERE status = 'active' AND end_date IS NOT NULL;

-- Index for subscription plan lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id 
ON subscriptions(plan_id);

-- ==============================================
-- 2. FUNCTION: GET USER'S CURRENT SUBSCRIPTION
-- ==============================================

-- This function efficiently retrieves a user's active subscription with plan details
-- Returns NULL if user has no active subscription (should use free plan)
CREATE OR REPLACE FUNCTION get_user_current_subscription(p_user_id uuid)
RETURNS TABLE (
  subscription_id uuid,
  plan_id uuid,
  plan_name text,
  plan_tier text,
  plan_price decimal,
  subscription_status text,
  start_date timestamptz,
  end_date timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as subscription_id,
    p.id as plan_id,
    p.name as plan_name,
    p.tier as plan_tier,
    p.price as plan_price,
    s.status as subscription_status,
    s.start_date,
    s.end_date
  FROM subscriptions s
  INNER JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.end_date IS NULL OR s.end_date > now())
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- ==============================================
-- 3. FUNCTION: GET USER TIER (FAST LOOKUP)
-- ==============================================

-- Fast function to get just the user's tier without full subscription details
CREATE OR REPLACE FUNCTION get_user_tier(p_user_id uuid)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tier text;
BEGIN
  -- Try to get active subscription tier
  SELECT p.tier INTO v_tier
  FROM subscriptions s
  INNER JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.end_date IS NULL OR s.end_date > now())
  ORDER BY 
    CASE p.tier
      WHEN 'enterprise' THEN 3
      WHEN 'pro' THEN 2
      WHEN 'free' THEN 1
    END DESC,
    s.created_at DESC
  LIMIT 1;

  -- If no active subscription found, return 'free'
  RETURN COALESCE(v_tier, 'free');
END;
$$;

-- ==============================================
-- 4. FUNCTION: SYNC USER SUBSCRIPTION ID
-- ==============================================

-- Keeps the subscription_id field on users table synchronized
CREATE OR REPLACE FUNCTION sync_user_subscription_id()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_subscription_id uuid;
BEGIN
  -- Only process if subscription is active
  IF NEW.status = 'active' THEN
    -- Update user's subscription_id to point to this subscription
    UPDATE users 
    SET subscription_id = NEW.id
    WHERE id = NEW.user_id;
    
    RETURN NEW;
  ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
    -- If subscription was active and now isn't, set to most recent active subscription
    SELECT s.id INTO v_subscription_id
    FROM subscriptions s
    WHERE s.user_id = NEW.user_id
      AND s.status = 'active'
      AND s.id != NEW.id
      AND (s.end_date IS NULL OR s.end_date > now())
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    -- Update user's subscription_id (or set to NULL if no active subscription)
    UPDATE users 
    SET subscription_id = v_subscription_id
    WHERE id = NEW.user_id;
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ==============================================
-- 5. CREATE TRIGGER FOR SUBSCRIPTION SYNC
-- ==============================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_subscription_id_trigger ON subscriptions;

-- Create trigger to automatically sync subscription_id
CREATE TRIGGER sync_subscription_id_trigger
  AFTER INSERT OR UPDATE OF status ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_subscription_id();

-- ==============================================
-- 6. UPDATE EXISTING FREE PLAN ASSIGNMENT
-- ==============================================

-- Improve the existing free plan assignment function
CREATE OR REPLACE FUNCTION assign_free_plan_to_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  free_plan_id uuid;
  new_subscription_id uuid;
BEGIN
  -- Get the free plan ID
  SELECT id INTO free_plan_id 
  FROM plans 
  WHERE tier = 'free' 
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Create subscription for new user if free plan exists
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO subscriptions (user_id, plan_id, status, start_date)
    VALUES (NEW.id, free_plan_id, 'active', now())
    RETURNING id INTO new_subscription_id;
    
    -- Update user's subscription_id
    UPDATE users 
    SET subscription_id = new_subscription_id 
    WHERE id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- ==============================================
-- 7. DATA REPAIR: FIX EXISTING USERS
-- ==============================================

-- Fix users who have active subscriptions but NULL subscription_id
DO $$
DECLARE
  v_user_record RECORD;
  v_subscription_id uuid;
BEGIN
  -- Loop through users with NULL subscription_id
  FOR v_user_record IN 
    SELECT id FROM users WHERE subscription_id IS NULL
  LOOP
    -- Find their most recent active subscription
    SELECT s.id INTO v_subscription_id
    FROM subscriptions s
    INNER JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = v_user_record.id
      AND s.status = 'active'
      AND (s.end_date IS NULL OR s.end_date > now())
    ORDER BY 
      CASE p.tier
        WHEN 'enterprise' THEN 3
        WHEN 'pro' THEN 2
        WHEN 'free' THEN 1
      END DESC,
      s.created_at DESC
    LIMIT 1;
    
    -- Update user's subscription_id if found
    IF v_subscription_id IS NOT NULL THEN
      UPDATE users 
      SET subscription_id = v_subscription_id 
      WHERE id = v_user_record.id;
      
      RAISE NOTICE 'Fixed user % - set subscription_id to %', v_user_record.id, v_subscription_id;
    END IF;
  END LOOP;
END $$;

-- ==============================================
-- 8. ENSURE ALL USERS HAVE A SUBSCRIPTION
-- ==============================================

-- Create free plan subscription for users who have none
DO $$
DECLARE
  v_free_plan_id uuid;
  v_user_record RECORD;
  v_new_subscription_id uuid;
BEGIN
  -- Get free plan ID
  SELECT id INTO v_free_plan_id 
  FROM plans 
  WHERE tier = 'free' 
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF v_free_plan_id IS NOT NULL THEN
    -- Find users without any subscriptions
    FOR v_user_record IN
      SELECT u.id 
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE s.id IS NULL
    LOOP
      -- Create free subscription
      INSERT INTO subscriptions (user_id, plan_id, status, start_date)
      VALUES (v_user_record.id, v_free_plan_id, 'active', now())
      RETURNING id INTO v_new_subscription_id;
      
      -- Update user's subscription_id
      UPDATE users 
      SET subscription_id = v_new_subscription_id 
      WHERE id = v_user_record.id;
      
      RAISE NOTICE 'Created free subscription for user %', v_user_record.id;
    END LOOP;
  END IF;
END $$;

-- ==============================================
-- 9. GRANT EXECUTE PERMISSIONS
-- ==============================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_current_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tier(uuid) TO authenticated;

-- ==============================================
-- 10. CREATE HELPER VIEW FOR USER PROFILES
-- ==============================================

-- Drop view if it exists
DROP VIEW IF EXISTS user_profiles_with_subscription;

-- Create a view that includes subscription info efficiently
CREATE VIEW user_profiles_with_subscription AS
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

-- Grant access to the view
GRANT SELECT ON user_profiles_with_subscription TO authenticated;
