/*
  # Fix RLS recursion issue

  1. New Functions
    - `get_my_role()` - SECURITY DEFINER function to safely get current user's role
  
  2. Policy Changes
    - Drop existing recursive policies on users table
    - Recreate policies using the new function to avoid recursion
  
  3. Security
    - Uses SECURITY DEFINER to bypass RLS when checking user roles
    - Maintains proper access control for admin operations
*/

-- Create SECURITY DEFINER function to get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM users WHERE id = auth.uid();
  RETURN user_role;
END;
$$;

-- Drop existing problematic policies that cause recursion
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;

-- Recreate policies using the SECURITY DEFINER function
CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

CREATE POLICY "Admins can update users"
ON public.users
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- Also fix other policies that might have similar recursion issues
DROP POLICY IF EXISTS "Admins can read all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can read all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can read all chats" ON public.chats;
DROP POLICY IF EXISTS "Admins can manage plans" ON public.plans;
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.admin_notifications;

-- Recreate these policies using the safe function
CREATE POLICY "Admins can read all subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

CREATE POLICY "System can manage subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

CREATE POLICY "Admins can read all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

CREATE POLICY "Admins can manage all documents"
ON public.documents
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

CREATE POLICY "Admins can read all chats"
ON public.chats
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

CREATE POLICY "Admins can manage plans"
ON public.plans
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

CREATE POLICY "Admins can manage notifications"
ON public.admin_notifications
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));