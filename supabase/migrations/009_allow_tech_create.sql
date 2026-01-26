-- Allow technicians to create customers and properties
-- Needed for the Quick Start scan-to-job flow

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Managers create customers" ON customers;

-- Create new policy that includes technicians
CREATE POLICY "Users create customers" ON customers
  FOR INSERT WITH CHECK (
    organization_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher', 'technician')
  );

-- Also fix properties if needed
DROP POLICY IF EXISTS "Dealership create properties" ON properties;
DROP POLICY IF EXISTS "Users create properties" ON properties;

CREATE POLICY "Users create properties" ON properties
  FOR INSERT WITH CHECK (
    created_by_org_id = get_user_org_id()
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher', 'technician')
  );

-- Phases - technicians need to create phases for new jobs
DROP POLICY IF EXISTS "Create phases" ON phases;

CREATE POLICY "Create phases" ON phases 
  FOR INSERT WITH CHECK (
    property_id IN (SELECT id FROM properties WHERE created_by_org_id = get_user_org_id())
    AND get_user_role() IN ('owner', 'admin', 'manager', 'dispatcher', 'technician')
  );
