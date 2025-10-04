/*
  # Fix Usage Tracking with Proper UPSERT Logic

  ## Summary
  This migration fixes the usage tracking system to properly increment usage counts
  for users throughout the day. Previously, the system attempted to INSERT new records
  for each action, which failed due to the UNIQUE constraint on (user_id, feature, date).

  ## Changes Made

  1. **New Function: increment_usage_count**
     - Handles UPSERT logic for usage tracking
     - Increments count if record exists for today
     - Creates new record if none exists
     - Returns the new count value
     - Thread-safe with proper locking

  2. **Helper Function: get_usage_count_today**
     - Efficiently retrieves current usage count for a user and feature
     - Returns 0 if no usage record exists
     - Used for quick limit checks

  3. **Performance Optimization**
     - Added index on (user_id, feature, date) for faster lookups
     - Function uses efficient UPSERT pattern

  ## Usage
  The function can be called from application code or edge functions:
  ```sql
  SELECT increment_usage_count(user_id, 'chat_message');
  SELECT get_usage_count_today(user_id, 'chat_message');
  ```

  ## Notes
  - Usage counts reset daily (based on date column)
  - All timestamps use UTC timezone
  - The function is atomic and handles concurrent requests safely
  - Existing RLS policies already allow INSERT and UPDATE operations
*/

-- Create a function to safely increment usage count with UPSERT logic
CREATE OR REPLACE FUNCTION increment_usage_count(
  p_user_id uuid,
  p_feature text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
  v_today date;
BEGIN
  v_today := CURRENT_DATE;
  
  -- Use INSERT ... ON CONFLICT to handle UPSERT atomically
  INSERT INTO usage_tracking (user_id, feature, date, count, metadata)
  VALUES (p_user_id, p_feature, v_today, 1, p_metadata)
  ON CONFLICT (user_id, feature, date)
  DO UPDATE SET
    count = usage_tracking.count + 1,
    metadata = CASE 
      WHEN p_metadata = '{}'::jsonb THEN usage_tracking.metadata
      ELSE p_metadata
    END
  RETURNING count INTO v_count;
  
  RETURN v_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_usage_count(uuid, text, jsonb) TO authenticated;

-- Ensure the index exists for optimal performance
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_feature_date 
ON usage_tracking(user_id, feature, date);

-- Create a helper function to get current usage count for today
CREATE OR REPLACE FUNCTION get_usage_count_today(
  p_user_id uuid,
  p_feature text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COALESCE(count, 0) INTO v_count
  FROM usage_tracking
  WHERE user_id = p_user_id
    AND feature = p_feature
    AND date = CURRENT_DATE;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_usage_count_today(uuid, text) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION increment_usage_count IS 'Atomically increments usage count for a user and feature, creating record if needed';
COMMENT ON FUNCTION get_usage_count_today IS 'Returns current usage count for a user and feature for today';
