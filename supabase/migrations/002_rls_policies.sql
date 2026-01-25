-- FieldSync Row Level Security Policies
-- Run this in the Supabase SQL Editor AFTER 001_initial_schema.sql

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_assignments ENABLE ROW LEVEL SECURITY;

-- Helper function: Get current user's org
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- ORGANIZATIONS
-- ============================================
-- Users can read their own org
CREATE POLICY "Users read own org" ON organizations
  FOR SELECT USING (id = get_user_org_id());

-- Users can read orgs they work with (via assignments)
CREATE POLICY "Users read assigned orgs" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT DISTINCT pa.organization_id FROM phase_assignments pa
      JOIN properties p ON pa.property_id = p.id
      WHERE p.dealership_id = get_user_org_id()
    )
  );

-- Owners can update their own org
CREATE POLICY "Owners update own org" ON organizations
  FOR UPDATE USING (
    id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- Anyone authenticated can create an org (for onboarding)
CREATE POLICY "Authenticated users create org" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- USERS
-- ============================================
-- Users can read users in their org
CREATE POLICY "Users read org users" ON users
  FOR SELECT USING (organization_id = get_user_org_id());

-- Users can read their own profile
CREATE POLICY "Users read own profile" ON users
  FOR SELECT USING (id = auth.uid());

-- Users can create their own profile (during onboarding)
CREATE POLICY "Users create own profile" ON users
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users update own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Admins can manage users in their org
CREATE POLICY "Admins manage org users" ON users
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- CUSTOMERS
-- ============================================
-- Users can read customers in their org
CREATE POLICY "Users read org customers" ON customers
  FOR SELECT USING (organization_id = get_user_org_id());

-- Managers+ can create customers
CREATE POLICY "Managers create customers" ON customers
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- Managers+ can update customers
CREATE POLICY "Managers update customers" ON customers
  FOR UPDATE USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- ============================================
-- PROPERTIES
-- ============================================
-- Dealership users see their dealership's properties
CREATE POLICY "Dealership sees own properties" ON properties
  FOR SELECT USING (dealership_id = get_user_org_id());

-- Contractors see assigned properties
CREATE POLICY "Contractors see assigned properties" ON properties
  FOR SELECT USING (
    id IN (
      SELECT property_id FROM phase_assignments
      WHERE organization_id = get_user_org_id()
    )
  );

-- Service companies see properties with service phases assigned
CREATE POLICY "Service sees assigned properties" ON properties
  FOR SELECT USING (
    id IN (
      SELECT property_id FROM phases
      WHERE assigned_org_id = get_user_org_id()
    )
  );

-- Managers can create properties
CREATE POLICY "Managers create properties" ON properties
  FOR INSERT WITH CHECK (
    dealership_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- Managers can update properties
CREATE POLICY "Managers update properties" ON properties
  FOR UPDATE USING (
    dealership_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- ============================================
-- PHASES
-- ============================================
-- Users see phases on properties they can see
CREATE POLICY "Users see phases" ON phases
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties)
  );

-- Assigned users can update their phases
CREATE POLICY "Assigned update phases" ON phases
  FOR UPDATE USING (
    assigned_org_id = get_user_org_id()
    OR assigned_user_id = auth.uid()
  );

-- Dealership can create phases on their properties
CREATE POLICY "Dealership create phases" ON phases
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE dealership_id = get_user_org_id()
    )
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- Dealership can manage all phases on their properties
CREATE POLICY "Dealership manage phases" ON phases
  FOR ALL USING (
    property_id IN (
      SELECT id FROM properties WHERE dealership_id = get_user_org_id()
    )
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- ============================================
-- PHOTOS
-- ============================================
-- Users see photos on properties they can see
CREATE POLICY "Users see photos" ON photos
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties)
  );

-- Anyone assigned can add photos
CREATE POLICY "Assigned add photos" ON photos
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties)
  );

-- Photo owner can delete their photos
CREATE POLICY "Owner delete photos" ON photos
  FOR DELETE USING (taken_by_user_id = auth.uid());

-- ============================================
-- ISSUES
-- ============================================
-- Users see issues on properties they can see
CREATE POLICY "Users see issues" ON issues
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties)
  );

-- Anyone can report issues on properties they can see
CREATE POLICY "Users create issues" ON issues
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties)
  );

-- Assigned can update issues
CREATE POLICY "Assigned update issues" ON issues
  FOR UPDATE USING (
    assigned_to_org_id = get_user_org_id()
    OR assigned_to_user_id = auth.uid()
    OR reported_by_org_id = get_user_org_id()
  );

-- ============================================
-- MATERIALS LISTS
-- ============================================
-- Users see materials on properties they can see
CREATE POLICY "Users see materials" ON materials_lists
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties)
  );

-- Assigned can create materials lists
CREATE POLICY "Assigned create materials" ON materials_lists
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties)
  );

-- Assigned can update materials lists
CREATE POLICY "Assigned update materials" ON materials_lists
  FOR UPDATE USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN phases ph ON ph.property_id = p.id
      WHERE ph.assigned_org_id = get_user_org_id()
         OR ph.assigned_user_id = auth.uid()
    )
    OR created_by_user_id = auth.uid()
  );

-- ============================================
-- CONTRACTOR PROFILES
-- ============================================
-- Anyone can read contractor profiles (for directory)
CREATE POLICY "Read contractor profiles" ON contractor_profiles
  FOR SELECT USING (true);

-- Owners can manage their org's contractor profile
CREATE POLICY "Manage own contractor profile" ON contractor_profiles
  FOR ALL USING (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- PHASE ASSIGNMENTS
-- ============================================
-- Users see assignments for properties they can see
CREATE POLICY "Users see assignments" ON phase_assignments
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties)
    OR organization_id = get_user_org_id()
  );

-- Dealership can create assignments
CREATE POLICY "Dealership create assignments" ON phase_assignments
  FOR INSERT WITH CHECK (
    property_id IN (
      SELECT id FROM properties WHERE dealership_id = get_user_org_id()
    )
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

-- Assigned org can accept assignments
CREATE POLICY "Accept assignments" ON phase_assignments
  FOR UPDATE USING (
    organization_id = get_user_org_id()
  );
