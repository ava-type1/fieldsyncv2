-- Fix RLS policies for better performance
-- Wrap auth.uid() and current_setting() in (select ...) to avoid re-evaluation per row
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- Drop old phases policies (will be consolidated at the bottom)
DROP POLICY IF EXISTS "Assigned update phases" ON phases;

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

-- Fix sms_notifications policies
DROP POLICY IF EXISTS "Users can view notifications for their org's properties" ON sms_notifications;
CREATE POLICY "Users can view notifications for their org's properties"
  ON sms_notifications FOR SELECT
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      WHERE p.created_by_org_id IN (
        SELECT organization_id FROM users WHERE id = (select auth.uid())
      )
    )
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert notifications" ON sms_notifications;
CREATE POLICY "Users can insert notifications"
  ON sms_notifications FOR INSERT
  WITH CHECK (
    property_id IS NULL OR property_id IN (
      SELECT p.id FROM properties p
      WHERE p.created_by_org_id IN (
        SELECT organization_id FROM users WHERE id = (select auth.uid())
      )
    )
  );

-- Fix users table policies
DROP POLICY IF EXISTS "user_insert" ON users;
CREATE POLICY "user_insert" ON users
  FOR INSERT WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "user_update" ON users;
CREATE POLICY "user_update" ON users
  FOR UPDATE USING (id = (select auth.uid()));

-- Fix sms_notifications update policy
DROP POLICY IF EXISTS "Users can update their own notifications" ON sms_notifications;
CREATE POLICY "Users can update their own notifications"
  ON sms_notifications FOR UPDATE
  USING (user_id = (select auth.uid()));

-- Fix organization_subscriptions policy
DROP POLICY IF EXISTS "Users can view own org subscription" ON organization_subscriptions;
CREATE POLICY "Users can view own org subscription"
  ON organization_subscriptions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = (select auth.uid())
    )
  );

-- Fix organizations "org_insert" policy
DROP POLICY IF EXISTS "org_insert" ON organizations;
CREATE POLICY "org_insert" ON organizations
  FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Fix users "user_select" policy
DROP POLICY IF EXISTS "user_select" ON users;
CREATE POLICY "user_select" ON users
  FOR SELECT USING (id = (select auth.uid()));

-- Fix contractor_profiles - separate SELECT from INSERT/UPDATE/DELETE to avoid overlap
DROP POLICY IF EXISTS "Manage own contractor profile" ON contractor_profiles;
DROP POLICY IF EXISTS "Read contractor profiles" ON contractor_profiles;
DROP POLICY IF EXISTS "Insert own contractor profile" ON contractor_profiles;
DROP POLICY IF EXISTS "Update own contractor profile" ON contractor_profiles;
DROP POLICY IF EXISTS "Delete own contractor profile" ON contractor_profiles;

-- Anyone can read contractor profiles (directory)
CREATE POLICY "Read contractor profiles" ON contractor_profiles
  FOR SELECT USING (true);

-- Only org owners can manage their own profile (separate policies for each action)
CREATE POLICY "Insert own contractor profile" ON contractor_profiles
  FOR INSERT WITH CHECK (organization_id = get_user_org_id());

CREATE POLICY "Update own contractor profile" ON contractor_profiles
  FOR UPDATE USING (organization_id = get_user_org_id());

CREATE POLICY "Delete own contractor profile" ON contractor_profiles
  FOR DELETE USING (organization_id = get_user_org_id());

-- Fix customers - consolidate overlapping SELECT policies
DROP POLICY IF EXISTS "Portal users can view customer for their property" ON customers;
DROP POLICY IF EXISTS "cust_select" ON customers;
DROP POLICY IF EXISTS "Users read org customers" ON customers;

-- Single consolidated SELECT policy
CREATE POLICY "Read customers" ON customers
  FOR SELECT USING (
    -- Org users can read their org's customers
    organization_id = get_user_org_id()
    -- Portal users can view customer for their property (via portal code lookup)
    OR id IN (
      SELECT customer_id FROM properties 
      WHERE portal_code IS NOT NULL
    )
  );

-- Fix phases - consolidate overlapping policies
DROP POLICY IF EXISTS "Dealership create phases" ON phases;
DROP POLICY IF EXISTS "Dealership manage phases" ON phases;
DROP POLICY IF EXISTS "Portal users can view phases for their property" ON phases;
DROP POLICY IF EXISTS "Users see phases" ON phases;

-- Single SELECT policy for phases
CREATE POLICY "Read phases" ON phases
  FOR SELECT USING (
    -- Users see phases on properties they can see
    property_id IN (SELECT id FROM properties)
    -- Portal users can view phases for their property
    OR property_id IN (
      SELECT id FROM properties WHERE portal_code IS NOT NULL
    )
  );

-- Single INSERT policy for phases (dealership only)
CREATE POLICY "Create phases" ON phases
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE dealership_id = get_user_org_id()
    )
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- Single UPDATE policy for phases
CREATE POLICY "Update phases" ON phases
  FOR UPDATE USING (
    -- Dealership can update their phases
    property_id IN (
      SELECT id FROM properties WHERE dealership_id = get_user_org_id()
    )
    -- Or assigned users
    OR assigned_org_id = get_user_org_id()
    OR assigned_user_id = (select auth.uid())
  );

-- Single DELETE policy for phases (dealership only)
CREATE POLICY "Delete phases" ON phases
  FOR DELETE USING (
    property_id IN (
      SELECT id FROM properties WHERE dealership_id = get_user_org_id()
    )
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );
