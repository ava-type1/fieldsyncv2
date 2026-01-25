# Supabase Patterns for FieldSync

## Full Database Schema

```sql
-- supabase/migrations/001_initial_schema.sql

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- For geo queries (optional)

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
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
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
  sections INTEGER DEFAULT 1,  -- 1 = single-wide, 2 = double-wide, etc.
  
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
  estimated_duration INTEGER,  -- minutes
  
  -- Completion
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID REFERENCES users(id),
  
  -- Documentation
  notes TEXT,
  checklist_items JSONB DEFAULT '[]',
  
  -- Signatures (stored as URLs to signature images)
  customer_signature_url TEXT,
  customer_signed_at TIMESTAMPTZ,
  technician_signature_url TEXT,
  technician_signed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique phase per property
  UNIQUE(property_id, type)
);

-- ============================================
-- PHOTOS
-- ============================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  phase_id UUID REFERENCES phases(id) ON DELETE SET NULL,
  issue_id UUID,  -- Will reference issues table
  
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
-- CONTRACTOR PROFILES (Extended org info for contractors)
-- ============================================
CREATE TABLE contractor_profiles (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  
  -- Services
  services_offered TEXT[],
  service_area TEXT[],  -- ZIP codes or counties
  
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
-- PHASE ASSIGNMENTS (Links orgs to properties they can work on)
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
```

---

## Row Level Security (RLS) Policies

```sql
-- supabase/migrations/002_rls_policies.sql

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

-- ============================================
-- USERS
-- ============================================
-- Users can read users in their org
CREATE POLICY "Users read org users" ON users
  FOR SELECT USING (organization_id = get_user_org_id());

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

-- Managers+ can create/edit customers
CREATE POLICY "Managers manage customers" ON customers
  FOR ALL USING (
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

-- Managers can create/edit properties
CREATE POLICY "Managers manage properties" ON properties
  FOR INSERT WITH CHECK (
    dealership_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher')
  );

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
    property_id IN (
      SELECT id FROM properties  -- Relies on properties policies
    )
  );

-- Assigned users can update their phases
CREATE POLICY "Assigned update phases" ON phases
  FOR UPDATE USING (
    assigned_org_id = get_user_org_id()
    OR assigned_user_id = auth.uid()
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
    property_id IN (
      SELECT id FROM properties
    )
  );

-- ============================================
-- ISSUES
-- ============================================
-- Users see issues on properties they can see
CREATE POLICY "Users see issues" ON issues
  FOR SELECT USING (
    property_id IN (SELECT id FROM properties)
  );

-- Anyone can report issues
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

-- Assigned can manage materials
CREATE POLICY "Assigned manage materials" ON materials_lists
  FOR ALL USING (
    property_id IN (
      SELECT p.id FROM properties p
      JOIN phases ph ON ph.property_id = p.id
      WHERE ph.assigned_org_id = get_user_org_id()
         OR ph.assigned_user_id = auth.uid()
    )
  );
```

---

## Supabase Client Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
```

---

## Common Queries

### Get Properties for Service Tech
```typescript
// Fetch properties assigned to current user's org with service phases
async function getServiceProperties(userId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select(`
      *,
      customer:customers(*),
      phases!inner(
        *,
        photos(count)
      )
    `)
    .in('phases.category', ['service'])
    .in('phases.status', ['scheduled', 'in_progress'])
    .order('phases.scheduled_date', { ascending: true });

  return { data, error };
}
```

### Get Property with Full History
```typescript
async function getPropertyDetail(propertyId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select(`
      *,
      customer:customers(*),
      phases(
        *,
        assigned_org:organizations(name, type),
        assigned_user:users(full_name, phone),
        photos(*)
      ),
      issues(
        *,
        photos(*),
        assigned_org:organizations(name)
      ),
      materials_lists(*)
    `)
    .eq('id', propertyId)
    .order('phases.sort_order', { ascending: true })
    .single();

  return { data, error };
}
```

### Get Manager Dashboard Data
```typescript
async function getManagerDashboard(orgId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select(`
      id,
      street,
      city,
      overall_status,
      customer:customers(first_name, last_name, phone),
      phases(
        id,
        type,
        status,
        scheduled_date,
        assigned_user:users(full_name)
      )
    `)
    .eq('dealership_id', orgId)
    .in('overall_status', ['pending_delivery', 'in_progress'])
    .order('delivery_date', { ascending: true });

  return { data, error };
}
```

### Complete a Phase
```typescript
async function completePhase(
  phaseId: string, 
  userId: string,
  notes?: string
) {
  const { error } = await supabase
    .from('phases')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by_user_id: userId,
      notes
    })
    .eq('id', phaseId);

  return { error };
}
```

### Upload Photo
```typescript
async function uploadPhoto(
  file: File,
  propertyId: string,
  phaseId: string,
  photoType: string,
  userId: string
): Promise<{ url: string; error: any }> {
  // Upload to storage
  const fileName = `${propertyId}/${phaseId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(fileName, file);

  if (uploadError) return { url: '', error: uploadError };

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(fileName);

  // Create photo record
  const { error: insertError } = await supabase
    .from('photos')
    .insert({
      property_id: propertyId,
      phase_id: phaseId,
      url: publicUrl,
      photo_type: photoType,
      taken_by_user_id: userId
    });

  return { url: publicUrl, error: insertError };
}
```

### Create Property with Default Phases
```typescript
async function createProperty(
  propertyData: any,
  defaultPhases: string[]
) {
  // Start transaction
  const { data: property, error: propError } = await supabase
    .from('properties')
    .insert(propertyData)
    .select()
    .single();

  if (propError || !property) return { property: null, error: propError };

  // Create default phases
  const phasesToCreate = defaultPhases.map((type, index) => ({
    property_id: property.id,
    type,
    category: getPhaseCategory(type),
    sort_order: index,
    status: 'not_started'
  }));

  const { error: phasesError } = await supabase
    .from('phases')
    .insert(phasesToCreate);

  return { property, error: phasesError };
}

function getPhaseCategory(type: string): string {
  const categoryMap: Record<string, string> = {
    'site_clearing': 'site_prep',
    'pad_preparation': 'site_prep',
    'home_delivery': 'delivery',
    'set_and_level': 'setup',
    'blocking': 'setup',
    'tie_downs': 'setup',
    'electrical_hookup': 'utilities',
    'plumbing_hookup': 'utilities',
    'skirting': 'exterior',
    'porch_steps': 'exterior',
    'walkthrough': 'service',
    'punch_list': 'service',
  };
  return categoryMap[type] || 'other';
}
```

---

## Real-Time Subscriptions

### Subscribe to Property Updates (Manager View)
```typescript
function subscribeToPropertyUpdates(
  orgId: string,
  onUpdate: (payload: any) => void
) {
  const subscription = supabase
    .channel('property-updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'phases',
        filter: `property_id=in.(select id from properties where dealership_id='${orgId}')`
      },
      onUpdate
    )
    .subscribe();

  return subscription;
}
```

---

## Storage Buckets

Create these buckets in Supabase dashboard:

1. **photos** - Job site photos
   - Public access
   - Max file size: 10MB
   - Allowed types: image/*

2. **signatures** - Customer signatures
   - Private access
   - Max file size: 1MB
   - Allowed types: image/png

3. **documents** - Receipts, reports
   - Private access
   - Max file size: 25MB
   - Allowed types: image/*, application/pdf
