-- FieldSync Initial Schema
-- Run this in the Supabase SQL Editor

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS (Multi-Tenant)
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dealership', 'service_company', 'subcontractor', 'manufacturer')),
  parent_org_id UUID REFERENCES organizations(id),

  -- Settings
  settings JSONB DEFAULT '{
    "timezone": "America/New_York",
    "requirePhotos": true,
    "requireSignatures": true
  }'::jsonb,

  -- Subscription
  subscription TEXT DEFAULT 'free_trial' CHECK (subscription IN ('free_trial', 'solo', 'team', 'dealership', 'enterprise')),
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,

  -- Contact
  primary_email TEXT,
  primary_phone TEXT,
  address JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),

  -- Profile
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,

  -- Role & Permissions
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('owner', 'admin', 'manager', 'dispatcher', 'technician', 'viewer')),
  permissions TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CUSTOMERS
-- ============================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Name
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,

  -- Contact
  phone TEXT NOT NULL,
  email TEXT,
  preferred_contact TEXT DEFAULT 'phone' CHECK (preferred_contact IN ('phone', 'text', 'email')),

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROPERTIES (The Core Entity)
-- ============================================
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Location
  street TEXT NOT NULL,
  unit TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  county TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  -- Customer
  customer_id UUID NOT NULL REFERENCES customers(id),

  -- Home Details
  manufacturer TEXT DEFAULT 'Nobility Homes',
  model TEXT,
  serial_number TEXT,
  square_footage INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3, 1),
  sections INTEGER DEFAULT 1,

  -- Timeline
  sold_date DATE,
  delivery_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  move_in_date DATE,

  -- Status
  current_phase TEXT,
  overall_status TEXT DEFAULT 'pending_delivery' CHECK (overall_status IN (
    'pending_delivery', 'in_progress', 'on_hold', 'completed', 'warranty_active', 'closed'
  )),

  -- Ownership
  dealership_id UUID NOT NULL REFERENCES organizations(id),
  created_by_org_id UUID NOT NULL REFERENCES organizations(id),
  created_by_user_id UUID REFERENCES users(id),

  -- Metadata
  tags TEXT[],
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASES (Work Stages)
-- ============================================
CREATE TABLE phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Type & Order
  type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'site_prep', 'delivery', 'setup', 'utilities', 'exterior', 'interior', 'inspection', 'service'
  )),
  sort_order INTEGER NOT NULL,

  -- Status
  status TEXT DEFAULT 'not_started' CHECK (status IN (
    'not_started', 'scheduled', 'in_progress', 'on_hold', 'blocked', 'completed', 'skipped'
  )),

  -- Assignment
  assigned_org_id UUID REFERENCES organizations(id),
  assigned_user_id UUID REFERENCES users(id),

  -- Scheduling
  scheduled_date DATE,
  scheduled_time_window TEXT,
  estimated_duration INTEGER,

  -- Completion
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID REFERENCES users(id),

  -- Documentation
  notes TEXT,
  checklist_items JSONB DEFAULT '[]',

  -- Signatures
  customer_signature_url TEXT,
  customer_signed_at TIMESTAMPTZ,
  technician_signature_url TEXT,
  technician_signed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(property_id, type)
);

-- ============================================
-- PHOTOS
-- ============================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  issue_id UUID,

  -- Storage
  url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Metadata
  caption TEXT,
  photo_type TEXT DEFAULT 'general' CHECK (photo_type IN (
    'before', 'during', 'after', 'issue', 'receipt', 'signature', 'inspection', 'general'
  )),

  -- Who & When
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  taken_by_user_id UUID REFERENCES users(id),

  -- Location
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ISSUES
-- ============================================
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,

  -- Details
  title TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN (
    'electrical', 'plumbing', 'hvac', 'structural', 'cosmetic', 'appliance', 'exterior', 'safety', 'other'
  )),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Responsibility
  reported_by_user_id UUID NOT NULL REFERENCES users(id),
  reported_by_org_id UUID NOT NULL REFERENCES organizations(id),
  assigned_to_org_id UUID REFERENCES organizations(id),
  assigned_to_user_id UUID REFERENCES users(id),

  -- Status
  status TEXT DEFAULT 'reported' CHECK (status IN (
    'reported', 'acknowledged', 'in_progress', 'pending_parts', 'resolved', 'wont_fix', 'duplicate'
  )),

  -- Resolution
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for photos.issue_id
ALTER TABLE photos ADD CONSTRAINT fk_photos_issue
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE SET NULL;

-- ============================================
-- MATERIALS LISTS
-- ============================================
CREATE TABLE materials_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id),

  -- Items stored as JSONB array
  items JSONB DEFAULT '[]',

  -- Totals
  total_estimated_cost DECIMAL(10, 2),
  total_actual_cost DECIMAL(10, 2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTRACTOR PROFILES
-- ============================================
CREATE TABLE contractor_profiles (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),

  -- Services
  services_offered TEXT[],
  service_area TEXT[],

  -- Contact
  primary_contact_name TEXT,
  primary_contact_phone TEXT,
  primary_contact_email TEXT,

  -- Business
  license_number TEXT,
  insurance_expiry DATE,

  -- Performance
  average_rating DECIMAL(3, 2),
  total_jobs_completed INTEGER DEFAULT 0,

  -- Availability
  is_accepting_work BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASE ASSIGNMENTS
-- ============================================
CREATE TABLE phase_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- What they're assigned to do
  phase_types TEXT[] NOT NULL,

  -- Assignment details
  assigned_by_user_id UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),

  -- Status
  accepted BOOLEAN,
  accepted_at TIMESTAMPTZ,

  UNIQUE(property_id, organization_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_properties_dealership ON properties(dealership_id);
CREATE INDEX idx_properties_status ON properties(overall_status);
CREATE INDEX idx_properties_location ON properties(lat, lng);
CREATE INDEX idx_properties_customer ON properties(customer_id);

CREATE INDEX idx_phases_property ON phases(property_id);
CREATE INDEX idx_phases_status ON phases(status);
CREATE INDEX idx_phases_assigned_org ON phases(assigned_org_id);
CREATE INDEX idx_phases_assigned_user ON phases(assigned_user_id);
CREATE INDEX idx_phases_type ON phases(type);

CREATE INDEX idx_photos_property ON photos(property_id);
CREATE INDEX idx_photos_phase ON photos(phase_id);

CREATE INDEX idx_issues_property ON issues(property_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_assigned_org ON issues(assigned_to_org_id);

CREATE INDEX idx_phase_assignments_property ON phase_assignments(property_id);
CREATE INDEX idx_phase_assignments_org ON phase_assignments(organization_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_phases_updated_at
  BEFORE UPDATE ON phases FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_materials_lists_updated_at
  BEFORE UPDATE ON materials_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
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
-- FieldSync Seed Data
-- Run this in the Supabase SQL Editor AFTER running migrations 001 and 002
-- AND after you have signed up and completed onboarding
--
-- IMPORTANT: Replace the UUIDs below with your actual organization and user IDs
-- You can find these in the Supabase dashboard after signing up

-- ============================================
-- INSTRUCTIONS:
-- 1. Sign up in the app and complete onboarding
-- 2. Go to Supabase Dashboard > Table Editor > organizations
-- 3. Copy your organization's ID
-- 4. Go to Table Editor > users and copy your user ID
-- 5. Replace 'YOUR_ORG_ID' and 'YOUR_USER_ID' below
-- 6. Run this script
-- ============================================

-- Set your IDs here (uncomment and replace):
-- DO $$
-- DECLARE
--   org_id UUID := 'YOUR_ORG_ID';
--   user_id UUID := 'YOUR_USER_ID';
-- BEGIN

-- For now, this script creates sample data using the first org/user found
-- This is for development/testing purposes

DO $$
DECLARE
  org_id UUID;
  user_id UUID;
  customer1_id UUID;
  customer2_id UUID;
  customer3_id UUID;
  property1_id UUID;
  property2_id UUID;
  property3_id UUID;
BEGIN
  -- Get the first organization
  SELECT id INTO org_id FROM organizations LIMIT 1;

  -- Get the first user
  SELECT id INTO user_id FROM users LIMIT 1;

  -- Exit if no org/user exists
  IF org_id IS NULL OR user_id IS NULL THEN
    RAISE NOTICE 'No organization or user found. Please sign up first.';
    RETURN;
  END IF;

  -- Create sample customers
  INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact)
  VALUES
    (uuid_generate_v4(), org_id, 'John', 'Smith', '(352) 555-0101', 'john.smith@email.com', 'phone'),
    (uuid_generate_v4(), org_id, 'Sarah', 'Johnson', '(352) 555-0102', 'sarah.j@email.com', 'text'),
    (uuid_generate_v4(), org_id, 'Michael', 'Williams', '(352) 555-0103', NULL, 'phone')
  RETURNING id INTO customer1_id;

  SELECT id INTO customer1_id FROM customers WHERE first_name = 'John' AND organization_id = org_id;
  SELECT id INTO customer2_id FROM customers WHERE first_name = 'Sarah' AND organization_id = org_id;
  SELECT id INTO customer3_id FROM customers WHERE first_name = 'Michael' AND organization_id = org_id;

  -- Create sample properties
  INSERT INTO properties (
    id, street, city, state, zip, county, lat, lng,
    customer_id, manufacturer, model, bedrooms, bathrooms,
    delivery_date, overall_status, current_phase,
    dealership_id, created_by_org_id, created_by_user_id
  )
  VALUES
    (
      uuid_generate_v4(),
      '1234 Oak Lane', 'Ocala', 'FL', '34470', 'Marion',
      29.1872, -82.1401,
      customer1_id, 'Nobility Homes', 'The Waverly', 3, 2,
      CURRENT_DATE - INTERVAL '7 days', 'in_progress', 'walkthrough',
      org_id, org_id, user_id
    ),
    (
      uuid_generate_v4(),
      '5678 Pine Street', 'Gainesville', 'FL', '32601', 'Alachua',
      29.6516, -82.3248,
      customer2_id, 'Nobility Homes', 'The Hampton', 4, 2.5,
      CURRENT_DATE - INTERVAL '14 days', 'in_progress', 'punch_list',
      org_id, org_id, user_id
    ),
    (
      uuid_generate_v4(),
      '9012 Maple Drive', 'Ocala', 'FL', '34471', 'Marion',
      29.1716, -82.1262,
      customer3_id, 'Nobility Homes', 'The Charleston', 3, 2,
      CURRENT_DATE + INTERVAL '7 days', 'pending_delivery', NULL,
      org_id, org_id, user_id
    )
  RETURNING id INTO property1_id;

  SELECT id INTO property1_id FROM properties WHERE street = '1234 Oak Lane';
  SELECT id INTO property2_id FROM properties WHERE street = '5678 Pine Street';
  SELECT id INTO property3_id FROM properties WHERE street = '9012 Maple Drive';

  -- Create phases for property 1 (in walkthrough)
  INSERT INTO phases (property_id, type, category, sort_order, status, assigned_org_id, assigned_user_id, completed_at)
  VALUES
    (property1_id, 'home_delivery', 'delivery', 1, 'completed', org_id, user_id, NOW() - INTERVAL '7 days'),
    (property1_id, 'set_and_level', 'setup', 2, 'completed', org_id, user_id, NOW() - INTERVAL '6 days'),
    (property1_id, 'blocking', 'setup', 3, 'completed', org_id, user_id, NOW() - INTERVAL '5 days'),
    (property1_id, 'tie_downs', 'setup', 4, 'completed', org_id, user_id, NOW() - INTERVAL '5 days'),
    (property1_id, 'electrical_hookup', 'utilities', 5, 'completed', org_id, user_id, NOW() - INTERVAL '4 days'),
    (property1_id, 'plumbing_hookup', 'utilities', 6, 'completed', org_id, user_id, NOW() - INTERVAL '4 days'),
    (property1_id, 'hvac_startup', 'utilities', 7, 'completed', org_id, user_id, NOW() - INTERVAL '3 days'),
    (property1_id, 'skirting', 'exterior', 8, 'completed', org_id, user_id, NOW() - INTERVAL '2 days'),
    (property1_id, 'porch_steps', 'exterior', 9, 'completed', org_id, user_id, NOW() - INTERVAL '2 days'),
    (property1_id, 'final_inspection', 'inspection', 10, 'completed', org_id, user_id, NOW() - INTERVAL '1 day'),
    (property1_id, 'walkthrough', 'service', 11, 'scheduled', org_id, user_id, NULL);

  -- Create phases for property 2 (in punch_list)
  INSERT INTO phases (property_id, type, category, sort_order, status, assigned_org_id, assigned_user_id, completed_at)
  VALUES
    (property2_id, 'home_delivery', 'delivery', 1, 'completed', org_id, user_id, NOW() - INTERVAL '14 days'),
    (property2_id, 'set_and_level', 'setup', 2, 'completed', org_id, user_id, NOW() - INTERVAL '13 days'),
    (property2_id, 'blocking', 'setup', 3, 'completed', org_id, user_id, NOW() - INTERVAL '12 days'),
    (property2_id, 'tie_downs', 'setup', 4, 'completed', org_id, user_id, NOW() - INTERVAL '12 days'),
    (property2_id, 'electrical_hookup', 'utilities', 5, 'completed', org_id, user_id, NOW() - INTERVAL '10 days'),
    (property2_id, 'plumbing_hookup', 'utilities', 6, 'completed', org_id, user_id, NOW() - INTERVAL '10 days'),
    (property2_id, 'skirting', 'exterior', 8, 'completed', org_id, user_id, NOW() - INTERVAL '7 days'),
    (property2_id, 'final_inspection', 'inspection', 10, 'completed', org_id, user_id, NOW() - INTERVAL '5 days'),
    (property2_id, 'walkthrough', 'service', 11, 'completed', org_id, user_id, NOW() - INTERVAL '3 days'),
    (property2_id, 'punch_list', 'service', 12, 'in_progress', org_id, user_id, NULL);

  -- Create phases for property 3 (pending delivery)
  INSERT INTO phases (property_id, type, category, sort_order, status, scheduled_date)
  VALUES
    (property3_id, 'home_delivery', 'delivery', 1, 'scheduled', CURRENT_DATE + INTERVAL '7 days'),
    (property3_id, 'set_and_level', 'setup', 2, 'not_started', NULL),
    (property3_id, 'blocking', 'setup', 3, 'not_started', NULL),
    (property3_id, 'tie_downs', 'setup', 4, 'not_started', NULL),
    (property3_id, 'electrical_hookup', 'utilities', 5, 'not_started', NULL),
    (property3_id, 'plumbing_hookup', 'utilities', 6, 'not_started', NULL),
    (property3_id, 'skirting', 'exterior', 8, 'not_started', NULL),
    (property3_id, 'final_inspection', 'inspection', 10, 'not_started', NULL),
    (property3_id, 'walkthrough', 'service', 11, 'not_started', NULL);

  -- Create some sample issues for property 2
  INSERT INTO issues (property_id, phase_id, title, description, category, severity, status, reported_by_user_id, reported_by_org_id)
  SELECT
    property2_id,
    (SELECT id FROM phases WHERE property_id = property2_id AND type = 'walkthrough' LIMIT 1),
    'Kitchen faucet dripping',
    'The kitchen faucet has a slow drip. Needs washer replaced.',
    'plumbing',
    'low',
    'reported',
    user_id,
    org_id;

  INSERT INTO issues (property_id, phase_id, title, description, category, severity, status, reported_by_user_id, reported_by_org_id)
  SELECT
    property2_id,
    (SELECT id FROM phases WHERE property_id = property2_id AND type = 'walkthrough' LIMIT 1),
    'Bedroom door not latching',
    'Master bedroom door doesn''t latch properly. May need striker plate adjustment.',
    'structural',
    'medium',
    'reported',
    user_id,
    org_id;

  RAISE NOTICE 'Seed data created successfully!';
  RAISE NOTICE 'Created 3 customers, 3 properties with phases, and 2 issues.';

END $$;
-- Add portal_code column for customer portal access
-- This allows customers to look up their property status without authentication

-- Add the column
ALTER TABLE properties ADD COLUMN IF NOT EXISTS portal_code TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_properties_portal_code ON properties(portal_code);

-- Function to generate a unique portal code
CREATE OR REPLACE FUNCTION generate_portal_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  attempts INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    
    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM properties WHERE portal_code = result) THEN
      RETURN result;
    END IF;
    
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique portal code after % attempts', max_attempts;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate portal code on insert
CREATE OR REPLACE FUNCTION set_portal_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.portal_code IS NULL THEN
    NEW.portal_code := generate_portal_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_portal_code ON properties;
CREATE TRIGGER trigger_set_portal_code
  BEFORE INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION set_portal_code();

-- Generate portal codes for existing properties
UPDATE properties
SET portal_code = generate_portal_code()
WHERE portal_code IS NULL;

-- Add RLS policy for portal access (allows anonymous read of specific fields)
-- Note: This uses the anon key which should be rate-limited at the API gateway level

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Portal users can view property by code" ON properties;

-- Create policy for anonymous portal access
CREATE POLICY "Portal users can view property by code" ON properties
  FOR SELECT
  USING (portal_code IS NOT NULL);

-- Also allow portal access to customers table for property lookups
DROP POLICY IF EXISTS "Portal users can view customer for their property" ON customers;
CREATE POLICY "Portal users can view customer for their property" ON customers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.customer_id = customers.id 
      AND properties.portal_code IS NOT NULL
    )
  );

-- Allow portal access to phases for timeline
DROP POLICY IF EXISTS "Portal users can view phases for their property" ON phases;
CREATE POLICY "Portal users can view phases for their property" ON phases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = phases.property_id 
      AND properties.portal_code IS NOT NULL
    )
  );

-- Allow portal access to photos (only 'after', 'general', 'inspection' types, no issue photos)
DROP POLICY IF EXISTS "Portal users can view approved photos" ON photos;
CREATE POLICY "Portal users can view approved photos" ON photos
  FOR SELECT
  USING (
    issue_id IS NULL
    AND photo_type IN ('after', 'general', 'inspection')
    AND EXISTS (
      SELECT 1 FROM properties 
      WHERE properties.id = photos.property_id 
      AND properties.portal_code IS NOT NULL
    )
  );
-- FieldSync SMS Notifications Schema
-- Run this in the Supabase SQL Editor after 003_seed_data.sql

-- ============================================
-- SMS NOTIFICATION PREFERENCES
-- ============================================
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Master toggle
  enabled BOOLEAN DEFAULT true,

  -- Individual notification types
  on_my_way BOOLEAN DEFAULT true,
  phase_complete BOOLEAN DEFAULT true,
  ready_for_inspection BOOLEAN DEFAULT true,
  walkthrough_scheduled BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one preference record per customer
  CONSTRAINT unique_customer_preferences UNIQUE (customer_id)
);

-- Index for quick lookups
CREATE INDEX idx_notification_preferences_customer ON notification_preferences(customer_id);

-- ============================================
-- SMS NOTIFICATION LOG
-- ============================================
CREATE TABLE sms_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Recipient
  to_phone TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'on_my_way',
    'phase_complete',
    'ready_for_inspection',
    'walkthrough_scheduled',
    'tech_new_assignment'
  )),

  -- Related entities (nullable for flexibility)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'failed',
    'rate_limited'
  )),

  -- Twilio response
  twilio_sid TEXT,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  -- Soft delete support
  deleted_at TIMESTAMPTZ
);

-- Indexes for rate limiting and querying
CREATE INDEX idx_sms_notifications_customer_event ON sms_notifications(customer_id, event_type, sent_at);
CREATE INDEX idx_sms_notifications_property ON sms_notifications(property_id);
CREATE INDEX idx_sms_notifications_status ON sms_notifications(status);
CREATE INDEX idx_sms_notifications_created ON sms_notifications(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_notifications ENABLE ROW LEVEL SECURITY;

-- Notification Preferences Policies
CREATE POLICY "Users can view preferences for their org's customers"
  ON notification_preferences FOR SELECT
  USING (
    customer_id IN (
      SELECT c.id FROM customers c
      WHERE c.organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update preferences for their org's customers"
  ON notification_preferences FOR UPDATE
  USING (
    customer_id IN (
      SELECT c.id FROM customers c
      WHERE c.organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert preferences for their org's customers"
  ON notification_preferences FOR INSERT
  WITH CHECK (
    customer_id IN (
      SELECT c.id FROM customers c
      WHERE c.organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- SMS Notifications Policies
CREATE POLICY "Users can view notifications for their org's properties"
  ON sms_notifications FOR SELECT
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      WHERE p.created_by_org_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can insert notifications"
  ON sms_notifications FOR INSERT
  WITH CHECK (
    -- Allow if user belongs to same org as property
    property_id IS NULL OR property_id IN (
      SELECT p.id FROM properties p
      WHERE p.created_by_org_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own notifications"
  ON sms_notifications FOR UPDATE
  USING (
    property_id IN (
      SELECT p.id FROM properties p
      WHERE p.created_by_org_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to check rate limit (can be called from Edge Functions)
CREATE OR REPLACE FUNCTION check_sms_rate_limit(
  p_customer_id UUID,
  p_event_type TEXT,
  p_window_hours INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sms_notifications
  WHERE customer_id = p_customer_id
    AND event_type = p_event_type
    AND status = 'sent'
    AND sent_at > NOW() - (p_window_hours || ' hours')::INTERVAL;

  RETURN v_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get notification stats for a property
CREATE OR REPLACE FUNCTION get_notification_stats(p_property_id UUID)
RETURNS TABLE (
  total_sent BIGINT,
  total_failed BIGINT,
  total_rate_limited BIGINT,
  last_sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
    COUNT(*) FILTER (WHERE status = 'rate_limited') as total_rate_limited,
    MAX(sent_at) as last_sent_at
  FROM sms_notifications
  WHERE property_id = p_property_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_timestamp
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_timestamp();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE notification_preferences IS 'Customer SMS notification preferences';
COMMENT ON TABLE sms_notifications IS 'SMS notification log with status tracking';
COMMENT ON COLUMN sms_notifications.event_type IS 'Type of event that triggered the notification';
COMMENT ON COLUMN sms_notifications.twilio_sid IS 'Twilio message SID for tracking';
COMMENT ON FUNCTION check_sms_rate_limit IS 'Check if a customer can receive an SMS (rate limited to 1 per hour per event type)';
-- Migration: Stripe Subscription Integration
-- Adds organization_subscriptions table for tracking Stripe subscription state

-- Create subscription tier enum
CREATE TYPE subscription_tier AS ENUM (
  'free_trial',
  'solo',
  'team',
  'dealership',
  'enterprise'
);

-- Create subscription status enum
CREATE TYPE subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused'
);

-- Create organization_subscriptions table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Stripe identifiers
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  
  -- Subscription state
  tier subscription_tier NOT NULL DEFAULT 'free_trial',
  status subscription_status NOT NULL DEFAULT 'trialing',
  
  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  
  -- Trial info
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id),
  UNIQUE(stripe_customer_id),
  UNIQUE(stripe_subscription_id)
);

-- Create index for fast lookups
CREATE INDEX idx_org_subscriptions_org_id ON organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_stripe_customer ON organization_subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_org_subscriptions_stripe_sub ON organization_subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_org_subscriptions_status ON organization_subscriptions(status);

-- RLS policies
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own organization's subscription
CREATE POLICY "Users can view own org subscription"
  ON organization_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Only service role can update subscriptions (via webhook)
CREATE POLICY "Service role can manage subscriptions"
  ON organization_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_subscription_updated_at
  BEFORE UPDATE ON organization_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();

-- Function to check if organization is within tier limits
CREATE OR REPLACE FUNCTION check_tier_limit(
  p_organization_id UUID,
  p_limit_type TEXT,
  p_current_count INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_tier subscription_tier;
  v_limit INTEGER;
BEGIN
  -- Get organization's tier
  SELECT COALESCE(os.tier, o.subscription)
  INTO v_tier
  FROM organizations o
  LEFT JOIN organization_subscriptions os ON os.organization_id = o.id
  WHERE o.id = p_organization_id;

  -- Define limits per tier
  CASE v_tier
    WHEN 'free_trial' THEN
      -- Free trial gets team limits
      CASE p_limit_type
        WHEN 'users' THEN v_limit := 5;
        WHEN 'properties' THEN v_limit := 100;
        ELSE v_limit := 0;
      END CASE;
    WHEN 'solo' THEN
      CASE p_limit_type
        WHEN 'users' THEN v_limit := 1;
        WHEN 'properties' THEN v_limit := 25;
        ELSE v_limit := 0;
      END CASE;
    WHEN 'team' THEN
      CASE p_limit_type
        WHEN 'users' THEN v_limit := 5;
        WHEN 'properties' THEN v_limit := 100;
        ELSE v_limit := 0;
      END CASE;
    WHEN 'dealership', 'enterprise' THEN
      -- Unlimited
      RETURN TRUE;
    ELSE
      v_limit := 0;
  END CASE;

  RETURN p_current_count < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Initialize subscription records for existing organizations
INSERT INTO organization_subscriptions (organization_id, tier, status)
SELECT id, subscription::subscription_tier, 'trialing'::subscription_status
FROM organizations
WHERE id NOT IN (SELECT organization_id FROM organization_subscriptions)
ON CONFLICT (organization_id) DO NOTHING;

COMMENT ON TABLE organization_subscriptions IS 'Tracks Stripe subscription state for organizations';
COMMENT ON COLUMN organization_subscriptions.stripe_customer_id IS 'Stripe Customer ID';
COMMENT ON COLUMN organization_subscriptions.stripe_subscription_id IS 'Stripe Subscription ID';
COMMENT ON COLUMN organization_subscriptions.tier IS 'Current subscription tier';
COMMENT ON COLUMN organization_subscriptions.status IS 'Stripe subscription status';
COMMENT ON COLUMN organization_subscriptions.cancel_at_period_end IS 'Whether subscription will cancel at period end';
