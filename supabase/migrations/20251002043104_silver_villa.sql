/*
  # Add RLS policy for user insertion

  1. Security
    - Add policy to allow authenticated users to insert their own user records
    - Ensures users can only create records with their own auth.uid()

  This fixes the "new row violates row-level security policy" error during account creation.
*/

-- Allow authenticated users to insert their own user records
CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);