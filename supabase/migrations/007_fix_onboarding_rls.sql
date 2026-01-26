-- Fix RLS policies for onboarding flow
-- The problem: New users don't have a `users` table entry yet, so get_user_org_id() returns NULL
-- Also: Cascading RLS policies cause 500 errors when subqueries hit protected tables

-- First, update get_user_org_id to handle NULL gracefully (no error, just NULL)
-- Mark as STABLE for better query planning
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Same for get_user_role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- FIX ORGANIZATIONS POLICIES
-- ============================================
-- Drop problematic policies that cause cascading RLS issues
DROP POLICY IF EXISTS "Users read own org" ON organizations;
DROP POLICY IF EXISTS "Users read assigned orgs" ON organizations;
DROP POLICY IF EXISTS "New users can read their new org" ON organizations;

-- Simple policy: Users can read their own org
-- For new users during onboarding, this returns nothing (which is fine)
CREATE POLICY "Users read own org" ON organizations
  FOR SELECT USING (
    -- Check if user has an org
    id = get_user_org_id()
  );

-- Separate policy for assigned orgs - uses SECURITY DEFINER function to avoid RLS cascade
CREATE OR REPLACE FUNCTION get_assigned_org_ids(user_org_id UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT pa.organization_id 
  FROM phase_assignments pa
  JOIN properties p ON pa.property_id = p.id
  WHERE p.dealership_id = user_org_id
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY "Users read assigned orgs" ON organizations
  FOR SELECT USING (
    get_user_org_id() IS NOT NULL 
    AND id IN (SELECT get_assigned_org_ids(get_user_org_id()))
  );

-- ============================================
-- FIX USERS POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users create own profile" ON users;
DROP POLICY IF EXISTS "Users update own profile" ON users;
DROP POLICY IF EXISTS "Users upsert own profile" ON users;
DROP POLICY IF EXISTS "Users read own profile" ON users;

-- Users can always read their own profile
CREATE POLICY "Users read own profile" ON users
  FOR SELECT USING (id = auth.uid());

-- Users can insert their own profile (during signup/onboarding)
CREATE POLICY "Users create own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- ============================================
-- GRANT SERVICE ROLE BYPASS (for edge functions)
-- ============================================
-- This allows edge functions using service_role key to bypass RLS
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
