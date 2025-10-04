/*
  # Add Usage Limit Check Function

  1. New Function
    - `check_usage_limit`: Checks if user has exceeded their daily limit
      - Returns structured result with limit status
      - Includes current usage, limit, and remaining count
      - Admin users automatically bypass all limits
      - Returns upgrade_needed flag for UI

  2. Security
    - Function marked as SECURITY DEFINER
    - Granted execute to authenticated users
    - Handles all edge cases safely
*/

CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id uuid,
  p_feature text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_usage integer;
  v_max_limit integer;
  v_user_role text;
  v_plan_tier text;
  v_result jsonb;
BEGIN
  -- Get user role
  SELECT role INTO v_user_role
  FROM users
  WHERE id = p_user_id;
  
  -- Admin users bypass all limits
  IF v_user_role IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'is_admin', true,
      'current_usage', 0,
      'max_limit', -1,
      'remaining', -1,
      'upgrade_needed', false
    );
  END IF;
  
  -- Get current usage for today
  v_current_usage := get_usage_count_today(p_user_id, p_feature);
  
  -- Get user's plan limit
  SELECT 
    CASE 
      WHEN p_feature = 'chat_message' THEN p.max_chats_per_day
      ELSE -1
    END,
    p.tier
  INTO v_max_limit, v_plan_tier
  FROM users u
  LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
  LEFT JOIN plans p ON p.id = s.plan_id
  WHERE u.id = p_user_id
  LIMIT 1;
  
  -- If no limit found or limit is -1 (unlimited), allow
  IF v_max_limit IS NULL OR v_max_limit = -1 THEN
    v_max_limit := 50; -- Default free tier limit
  END IF;
  
  -- Check if limit exceeded
  IF v_current_usage >= v_max_limit THEN
    v_result := jsonb_build_object(
      'allowed', false,
      'is_admin', false,
      'current_usage', v_current_usage,
      'max_limit', v_max_limit,
      'remaining', 0,
      'upgrade_needed', true,
      'plan_tier', COALESCE(v_plan_tier, 'free')
    );
  ELSE
    v_result := jsonb_build_object(
      'allowed', true,
      'is_admin', false,
      'current_usage', v_current_usage,
      'max_limit', v_max_limit,
      'remaining', v_max_limit - v_current_usage,
      'upgrade_needed', false,
      'plan_tier', COALESCE(v_plan_tier, 'free')
    );
  END IF;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION check_usage_limit(uuid, text) TO authenticated;

COMMENT ON FUNCTION check_usage_limit IS 'Checks if user has exceeded their daily usage limit for a feature. Admin users automatically bypass limits.';
