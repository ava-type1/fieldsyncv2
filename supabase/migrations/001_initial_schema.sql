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
