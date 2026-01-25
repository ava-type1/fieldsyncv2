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
