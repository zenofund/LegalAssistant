/*
  # Add Foreign Key Constraint for users.subscription_id

  1. Changes
    - Add foreign key constraint from users.subscription_id to subscriptions.id
    - Add index on users.subscription_id for query performance
    - Set ON DELETE SET NULL to handle subscription deletion gracefully

  2. Security
    - No changes to RLS policies
    - Maintains existing table permissions

  3. Notes
    - This ensures referential integrity between users and subscriptions tables
    - The subscription_id field in users table is optional (nullable)
    - When a subscription is deleted, the user's subscription_id will be set to NULL
*/

-- Add index for better query performance on subscription_id lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_id 
  ON users(subscription_id) 
  WHERE subscription_id IS NOT NULL;

-- Add foreign key constraint with CASCADE options
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_subscription_id_fkey'
    AND table_name = 'users'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_subscription_id_fkey
      FOREIGN KEY (subscription_id)
      REFERENCES subscriptions(id)
      ON DELETE SET NULL;
  END IF;
END $$;
