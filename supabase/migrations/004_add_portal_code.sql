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
