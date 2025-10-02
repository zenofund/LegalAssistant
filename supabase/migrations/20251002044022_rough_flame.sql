/*
  # Add RLS policy for subscription insertion

  1. New Policy
    - Allow authenticated users to insert their own subscription records
    - This enables the `assign_free_plan_to_new_user()` trigger to work properly
    - Users can only create subscriptions for themselves (user_id = auth.uid())

  2. Security
    - Maintains data integrity by preventing users from creating subscriptions for others
    - Works with the existing trigger system for automatic free plan assignment
*/

-- Add policy to allow users to insert their own subscription records
CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());