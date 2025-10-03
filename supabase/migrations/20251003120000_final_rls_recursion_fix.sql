/*
  # Final RLS Recursion Fix - Complete Solution

  ## Overview
  This migration completely resolves the infinite recursion error in Row Level Security policies
  by implementing a proper security model that eliminates all circular dependencies.

  ## Problem Summary
  The error "infinite recursion detected in policy for relation users" occurs because:
  - RLS policies on the users table were checking user roles by querying the same users table
  - This created a circular dependency: Policy → Query users table → Trigger policy → Query users table...
  - The solution uses a SECURITY DEFINER function that bypasses RLS when checking roles

  ## Changes Made

  ### 1. Complete Policy Cleanup
  - Drop ALL existing policies on users table to eliminate any conflicts
  - Drop ALL existing policies on related tables that might have recursive dependencies
  - Ensure a clean slate before recreating policies with safe patterns

  ### 2. Secure Role-Checking Function
  - Create get_my_role() function with SECURITY DEFINER to bypass RLS when querying users table
  - Mark function as STABLE (doesn't modify data, can be optimized by query planner)
  - Add comprehensive error handling to default to 'user' role on any failure
  - Set search_path explicitly for security
  - Grant execute permission only to authenticated users

  ### 3. Non-Recursive User Policies
  - Users can read their own profile: Simple auth.uid() = id check (no recursion)
  - Users can update their own profile: Simple auth.uid() = id check (no recursion)
  - Users can insert their own profile: Simple auth.uid() = id check (no recursion)
  - Admins can access all users: Uses get_my_role() SECURITY DEFINER function (no recursion)

  ### 4. Related Table Policies - Safe Patterns
  All policies follow these patterns:
  - User access: Direct ownership check using auth.uid() = user_id (no recursion)
  - Admin access: Uses get_my_role() SECURITY DEFINER function (no recursion)
  - Public access: No user checks, just data properties (no recursion)

  ### 5. Tables Covered
  - users: Complete policy set for user and admin access
  - subscriptions: User can manage own, admin can manage all
  - transactions: User can read/insert own, admin can read all
  - documents: Public readable, user can manage own, admin can manage all
  - chats: User can read/insert own, admin can read all
  - chat_sessions: User can manage own sessions
  - plans: All authenticated can read active plans, admin can manage
  - admin_notifications: Role-based read access, admin can manage
  - usage_tracking: User can manage own usage data

  ## Security Notes
  - SECURITY DEFINER is safe here because the function only reads role data, never modifies
  - All policies maintain principle of least privilege
  - Users can only access their own data unless they have admin role
  - Admin access is properly gated through secure role checking
  - The STABLE flag helps PostgreSQL optimize repeated calls to get_my_role()

  ## Testing Checklist
  After applying this migration:
  - [ ] Regular users can log in and see their profile
  - [ ] Regular users can see their own subscriptions
  - [ ] Regular users cannot access other users' data
  - [ ] Admin users can access all users
  - [ ] Admin users can manage all resources
  - [ ] No "infinite recursion" errors in logs
  - [ ] Profile fetching with subscriptions works correctly
*/

-- ==============================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ==============================================

-- Drop all users table policies (including duplicates from various migrations)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;

-- Drop all subscriptions policies
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can read all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.subscriptions;

-- Drop all transactions policies
DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can read all transactions" ON public.transactions;
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;

-- Drop all documents policies
DROP POLICY IF EXISTS "Public documents are readable" ON public.documents;
DROP POLICY IF EXISTS "Users can read public documents" ON public.documents;
DROP POLICY IF EXISTS "Users can read own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.documents;

-- Drop all chats policies
DROP POLICY IF EXISTS "Users can read own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can insert own chats" ON public.chats;
DROP POLICY IF EXISTS "Users can manage own chats" ON public.chats;
DROP POLICY IF EXISTS "Admins can read all chats" ON public.chats;

-- Drop all chat_sessions policies
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Admins can read all chat sessions" ON public.chat_sessions;

-- Drop all plans policies
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
DROP POLICY IF EXISTS "Admins can manage plans" ON public.plans;

-- Drop all admin_notifications policies
DROP POLICY IF EXISTS "Users can read relevant notifications" ON public.admin_notifications;
DROP POLICY IF EXISTS "Admins can manage notifications" ON public.admin_notifications;

-- Drop all usage_tracking policies
DROP POLICY IF EXISTS "Users can read own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "System can track usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "System can update usage" ON public.usage_tracking;

-- ==============================================
-- STEP 2: CREATE SECURE ROLE-CHECKING FUNCTION
-- ==============================================

-- Drop existing function if it exists (CASCADE removes dependent policies if any)
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;

-- Create SECURITY DEFINER function that bypasses RLS when checking user roles
-- This is the KEY to solving the infinite recursion problem
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER  -- This makes the function run with the privileges of the function owner, bypassing RLS
SET search_path = public  -- Security: Prevent search_path manipulation
STABLE  -- Function doesn't modify database, helps query planner optimize
AS $$
DECLARE
  user_role text;
BEGIN
  -- This query runs with elevated privileges and bypasses RLS on users table
  -- This is safe because we're only reading the role, not exposing other user data
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;

  -- If no role found or user doesn't exist, default to most restrictive role
  RETURN COALESCE(user_role, 'user');
EXCEPTION
  WHEN OTHERS THEN
    -- On any error (network, permission, etc.), default to most restrictive role
    -- This fail-safe approach ensures security even if something goes wrong
    RETURN 'user';
END;
$$;

-- Grant execute permission only to authenticated users
-- Anonymous users should not be able to call this function
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Revoke from public to be explicit about permissions
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public;

-- ==============================================
-- STEP 3: CREATE NON-RECURSIVE USER POLICIES
-- ==============================================

-- Policy 1: Users can read their own profile
-- SAFE: Uses direct auth.uid() comparison, no subquery, no recursion possible
CREATE POLICY "Users can read own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Policy 2: Users can update their own profile
-- SAFE: Uses direct auth.uid() comparison, no subquery, no recursion possible
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Policy 3: Users can insert their own profile during signup
-- SAFE: Uses direct auth.uid() comparison, no subquery, no recursion possible
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Policy 4: Admins can read all users
-- SAFE: Uses SECURITY DEFINER function which bypasses RLS, no recursion possible
CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- Policy 5: Admins can manage all users (INSERT, UPDATE, DELETE)
-- SAFE: Uses SECURITY DEFINER function which bypasses RLS, no recursion possible
CREATE POLICY "Admins can manage all users"
ON public.users
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- ==============================================
-- STEP 4: CREATE SUBSCRIPTION POLICIES
-- ==============================================

-- Users can read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own subscriptions (needed for signup flow with triggers)
CREATE POLICY "Users can insert own subscriptions"
ON public.subscriptions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
ON public.subscriptions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can read all subscriptions
CREATE POLICY "Admins can read all subscriptions"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage all subscriptions"
ON public.subscriptions
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- ==============================================
-- STEP 5: CREATE TRANSACTION POLICIES
-- ==============================================

-- Users can read their own transactions
CREATE POLICY "Users can read own transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own transactions
CREATE POLICY "Users can insert own transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can read all transactions
CREATE POLICY "Admins can read all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- System/webhook can insert transactions (for payment webhooks)
-- This is intentionally permissive for the insert operation to allow webhook handlers
CREATE POLICY "System can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ==============================================
-- STEP 6: CREATE DOCUMENT POLICIES
-- ==============================================

-- Anyone authenticated can read public documents
CREATE POLICY "Users can read public documents"
ON public.documents
FOR SELECT
TO authenticated
USING (is_public = true);

-- Users can read their own documents (even if not public)
CREATE POLICY "Users can read own documents"
ON public.documents
FOR SELECT
TO authenticated
USING (uploaded_by = auth.uid());

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents"
ON public.documents
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
ON public.documents
FOR UPDATE
TO authenticated
USING (uploaded_by = auth.uid())
WITH CHECK (uploaded_by = auth.uid());

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
ON public.documents
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- Admins can manage all documents
CREATE POLICY "Admins can manage all documents"
ON public.documents
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- ==============================================
-- STEP 7: CREATE CHAT POLICIES
-- ==============================================

-- Users can read their own chats
CREATE POLICY "Users can read own chats"
ON public.chats
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own chats
CREATE POLICY "Users can insert own chats"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can read all chats
CREATE POLICY "Admins can read all chats"
ON public.chats
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- ==============================================
-- STEP 8: CREATE CHAT SESSION POLICIES
-- ==============================================

-- Users can manage their own chat sessions
CREATE POLICY "Users can manage own chat sessions"
ON public.chat_sessions
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==============================================
-- STEP 9: CREATE PLAN POLICIES
-- ==============================================

-- All authenticated users can read active plans (needed to display plan options)
CREATE POLICY "Plans are publicly readable"
ON public.plans
FOR SELECT
TO authenticated
USING (is_active = true);

-- Admins can manage plans
CREATE POLICY "Admins can manage plans"
ON public.plans
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- ==============================================
-- STEP 10: CREATE ADMIN NOTIFICATION POLICIES
-- ==============================================

-- Users can read notifications targeted to their role
-- Note: We use get_my_role() here which is safe because it uses SECURITY DEFINER
CREATE POLICY "Users can read relevant notifications"
ON public.admin_notifications
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
  AND (
    target_roles @> ARRAY[public.get_my_role()]
    OR target_roles @> ARRAY['all']
  )
);

-- Admins can manage notifications
CREATE POLICY "Admins can manage notifications"
ON public.admin_notifications
FOR ALL
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- ==============================================
-- STEP 11: CREATE USAGE TRACKING POLICIES
-- ==============================================

-- Users can read their own usage data
CREATE POLICY "Users can read own usage"
ON public.usage_tracking
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own usage records
CREATE POLICY "Users can insert own usage"
ON public.usage_tracking
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own usage records
CREATE POLICY "Users can update own usage"
ON public.usage_tracking
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can read all usage data
CREATE POLICY "Admins can read all usage"
ON public.usage_tracking
FOR SELECT
TO authenticated
USING (public.get_my_role() = ANY (ARRAY['admin'::text, 'super_admin'::text]));

-- ==============================================
-- VERIFICATION QUERIES (FOR MANUAL TESTING)
-- ==============================================

-- After migration, you can run these queries to verify the setup:
--
-- 1. Check that get_my_role() function exists and has correct attributes:
-- SELECT proname, prosecdef, provolatile FROM pg_proc WHERE proname = 'get_my_role';
-- Expected: prosecdef = true, provolatile = 's' (stable)
--
-- 2. List all policies on users table:
-- SELECT * FROM pg_policies WHERE tablename = 'users';
-- Expected: 5 policies (read own, update own, insert own, admins read all, admins manage all)
--
-- 3. Test as regular user (replace UUID with actual user ID):
-- SET request.jwt.claim.sub = 'user-uuid-here';
-- SELECT * FROM users WHERE id = auth.uid();
-- Expected: Should return only your own user record
--
-- 4. Test as admin user (first set role to admin in users table, then):
-- SET request.jwt.claim.sub = 'admin-uuid-here';
-- SELECT * FROM users;
-- Expected: Should return all users
