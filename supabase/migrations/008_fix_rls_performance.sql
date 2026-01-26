-- Fix RLS policies for better performance
-- Wrap auth.uid() and current_setting() in (select ...) to avoid re-evaluation per row
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Drop and recreate affected policies on phases table
DROP POLICY IF EXISTS "Assigned update phases" ON phases;
CREATE POLICY "Assigned update phases" ON phases
  FOR UPDATE USING (
    assigned_org_id = get_user_org_id()
    OR assigned_user_id = (select auth.uid())
  );

-- Fix users table policies
DROP POLICY IF EXISTS "Users read own profile" ON users;
CREATE POLICY "Users read own profile" ON users
  FOR SELECT USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users create own profile" ON users;
CREATE POLICY "Users create own profile" ON users
  FOR INSERT WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own profile" ON users;
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (id = (select auth.uid()));

-- Fix organizations policy
DROP POLICY IF EXISTS "Authenticated users create org" ON organizations;
CREATE POLICY "Authenticated users create org" ON organizations
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix photos policies that use auth.uid()
DROP POLICY IF EXISTS "Users create photos" ON photos;
CREATE POLICY "Users create photos" ON photos
  FOR INSERT WITH CHECK (
    created_by_user_id = (select auth.uid())
    AND property_id IN (SELECT id FROM properties)
  );

DROP POLICY IF EXISTS "Users see photos" ON photos;
CREATE POLICY "Users see photos" ON photos
  FOR SELECT USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN phases ph ON ph.property_id = p.id
      WHERE ph.assigned_org_id = get_user_org_id()
         OR ph.assigned_user_id = (select auth.uid())
    )
    OR created_by_user_id = (select auth.uid())
  );

-- Fix issues policy
DROP POLICY IF EXISTS "Users create issues" ON issues;
CREATE POLICY "Users create issues" ON issues
  FOR INSERT WITH CHECK (
    created_by_user_id = (select auth.uid())
    AND property_id IN (SELECT id FROM properties)
  );

-- Also update the helper function to use select pattern
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = (select auth.uid())
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = (select auth.uid())
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Fix photos "Owner delete photos" policy
DROP POLICY IF EXISTS "Owner delete photos" ON photos;
CREATE POLICY "Owner delete photos" ON photos
  FOR DELETE USING (created_by_user_id = (select auth.uid()));

-- Fix issues "Assigned update issues" policy
DROP POLICY IF EXISTS "Assigned update issues" ON issues;
CREATE POLICY "Assigned update issues" ON issues
  FOR UPDATE USING (
    created_by_user_id = (select auth.uid())
    OR property_id IN (
      SELECT p.id FROM properties p
      JOIN phases ph ON ph.property_id = p.id
      WHERE ph.assigned_org_id = get_user_org_id()
         OR ph.assigned_user_id = (select auth.uid())
    )
  );

-- Fix materials_lists "Assigned update materials" policy
DROP POLICY IF EXISTS "Assigned update materials" ON materials_lists;
CREATE POLICY "Assigned update materials" ON materials_lists
  FOR UPDATE USING (
    created_by_user_id = (select auth.uid())
    OR property_id IN (
      SELECT p.id FROM properties p
      JOIN phases ph ON ph.property_id = p.id
      WHERE ph.assigned_org_id = get_user_org_id()
         OR ph.assigned_user_id = (select auth.uid())
    )
  );

-- Fix notification_preferences policies
DROP POLICY IF EXISTS "Users can view preferences for their org's customers" ON notification_preferences;
CREATE POLICY "Users can view preferences for their org's customers"
  ON notification_preferences FOR SELECT
  USING (
    customer_id IN (
      SELECT c.id FROM customers c
      WHERE c.organization_id IN (
        SELECT organization_id FROM users WHERE id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can update preferences for their org's customers" ON notification_preferences;
CREATE POLICY "Users can update preferences for their org's customers"
  ON notification_preferences FOR UPDATE
  USING (
    customer_id IN (
      SELECT c.id FROM customers c
      WHERE c.organization_id IN (
        SELECT organization_id FROM users WHERE id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert preferences for their org's customers" ON notification_preferences;
CREATE POLICY "Users can insert preferences for their org's customers"
  ON notification_preferences FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT c.id FROM customers c
      WHERE c.organization_id IN (
        SELECT organization_id FROM users WHERE id = (select auth.uid())
      )
    )
  );
