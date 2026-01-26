-- ============================================
-- FIELDSYNC TEST DATA
-- Run this in Supabase SQL Editor
-- ============================================

-- First, get your organization ID (run this separately first to get the ID)
-- SELECT id FROM organizations LIMIT 1;

-- Replace 'YOUR_ORG_ID' below with your actual organization ID
-- Replace 'YOUR_USER_ID' with your user ID

DO $$
DECLARE
    org_id UUID;
    usr_id UUID;
    cust1_id UUID;
    cust2_id UUID;
    cust3_id UUID;
    cust4_id UUID;
    cust5_id UUID;
    cust6_id UUID;
    cust7_id UUID;
    cust8_id UUID;
    prop1_id UUID;
    prop2_id UUID;
    prop3_id UUID;
    prop4_id UUID;
    prop5_id UUID;
    prop6_id UUID;
    prop7_id UUID;
    prop8_id UUID;
BEGIN
    -- Get first organization and user
    SELECT id INTO org_id FROM organizations LIMIT 1;
    SELECT user_id INTO usr_id FROM organization_members WHERE organization_id = org_id LIMIT 1;
    
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'No organization found. Please create one first.';
    END IF;

    -- ============================================
    -- CUSTOMERS (Florida addresses near Ocala/Jacksonville)
    -- ============================================
    
    -- Customer 1: Jacksonville
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'Jessica', 'Noel-Medeiros', '904-555-1234', 'jessica.nm@email.com', 'phone', 'Work: 904-555-5678')
    RETURNING id INTO cust1_id;

    -- Customer 2: Ocala
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'Robert', 'Thompson', '352-555-2345', 'rthompson@email.com', 'text', NULL)
    RETURNING id INTO cust2_id;

    -- Customer 3: Gainesville
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'Maria', 'Santos', '352-555-3456', 'maria.santos@email.com', 'phone', 'Spanish speaker')
    RETURNING id INTO cust3_id;

    -- Customer 4: Palm Coast
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'James', 'Wilson', '386-555-4567', NULL, 'phone', 'Retired, home most days')
    RETURNING id INTO cust4_id;

    -- Customer 5: Yulee
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'Patricia', 'Davis', '904-555-5678', 'pdavis@email.com', 'text', NULL)
    RETURNING id INTO cust5_id;

    -- Customer 6: Orange Park
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'Michael', 'Johnson', '904-555-6789', 'mjohnson@email.com', 'phone', 'Work: 904-555-9999')
    RETURNING id INTO cust6_id;

    -- Customer 7: Middleburg
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'Linda', 'Martinez', '904-555-7890', NULL, 'phone', 'Call before 8am or after 5pm')
    RETURNING id INTO cust7_id;

    -- Customer 8: St Augustine
    INSERT INTO customers (id, organization_id, first_name, last_name, phone, email, preferred_contact, notes)
    VALUES (gen_random_uuid(), org_id, 'David', 'Anderson', '904-555-8901', 'danderson@email.com', 'text', NULL)
    RETURNING id INTO cust8_id;

    -- ============================================
    -- PROPERTIES (with realistic FL coordinates)
    -- ============================================

    -- Property 1: Jacksonville - Walk-through needed
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust1_id, org_id, '9982 Frankella Rd', 'Jacksonville', 'FL', '32208', 30.4019, -81.7214, 'Nobility Homes', 'N1-17552', 'in_progress', 'Initial Walk-Through')
    RETURNING id INTO prop1_id;

    -- Property 2: Ocala - Return work order
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust2_id, org_id, '4521 NW 35th St', 'Ocala', 'FL', '34482', 29.2108, -82.1879, 'Nobility Homes', 'N1-17890', 'in_progress', 'Return Work Order #1')
    RETURNING id INTO prop2_id;

    -- Property 3: Gainesville - Completed
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust3_id, org_id, '8832 SW 24th Ave', 'Gainesville', 'FL', '32607', 29.6195, -82.4002, 'Nobility Homes', 'N1-16234', 'completed', NULL)
    RETURNING id INTO prop3_id;

    -- Property 4: Palm Coast - Walk-through scheduled
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust4_id, org_id, '15 Pine Grove Dr', 'Palm Coast', 'FL', '32164', 29.5389, -81.2456, 'Nobility Homes', 'N1-18001', 'pending_delivery', 'Initial Walk-Through')
    RETURNING id INTO prop4_id;

    -- Property 5: Yulee - In progress
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust5_id, org_id, '96042 Marsh Lakes Dr', 'Yulee', 'FL', '32097', 30.6318, -81.5465, 'Nobility Homes', 'N1-17445', 'in_progress', 'Return Work Order #1')
    RETURNING id INTO prop5_id;

    -- Property 6: Orange Park - Walk-through today
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust6_id, org_id, '2847 Moody Ave', 'Orange Park', 'FL', '32073', 30.1658, -81.7065, 'Nobility Homes', 'N1-18102', 'in_progress', 'Initial Walk-Through')
    RETURNING id INTO prop6_id;

    -- Property 7: Middleburg - Return work order #2
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust7_id, org_id, '1567 Nolan Rd', 'Middleburg', 'FL', '32068', 30.0689, -81.8607, 'Nobility Homes', 'N1-16998', 'in_progress', 'Return Work Order #2')
    RETURNING id INTO prop7_id;

    -- Property 8: St Augustine - Warranty
    INSERT INTO properties (id, customer_id, created_by_org_id, street, city, state, zip, lat, lng, manufacturer, serial_number, overall_status, current_phase)
    VALUES (gen_random_uuid(), cust8_id, org_id, '421 Shores Blvd', 'St Augustine', 'FL', '32086', 29.8612, -81.3142, 'Nobility Homes', 'N1-15567', 'warranty_active', NULL)
    RETURNING id INTO prop8_id;

    -- ============================================
    -- PHASES
    -- ============================================

    -- Property 1 phases (Walk-through not started)
    INSERT INTO phases (property_id, type, category, sort_order, status, notes)
    VALUES 
        (prop1_id, 'Initial Walk-Through', 'service', 1, 'not_started', 'Lot #: 18-Yulee, Salesperson: Halley'),
        (prop1_id, 'Return Work Order #1', 'service', 2, 'not_started', NULL);

    -- Property 2 phases (Walk-through done, return needed)
    INSERT INTO phases (property_id, type, category, sort_order, status, completed_at, notes)
    VALUES 
        (prop2_id, 'Initial Walk-Through', 'service', 1, 'completed', NOW() - INTERVAL '3 days', 'Completed. 5 items need attention.'),
        (prop2_id, 'Return Work Order #1', 'service', 2, 'scheduled', NULL, E'Items to fix:\n• Adjust front door\n• Kitchen faucet leak\n• Bedroom 2 window sticks\n• Caulk master bath\n• HVAC filter');

    -- Property 3 phases (All done)
    INSERT INTO phases (property_id, type, category, sort_order, status, completed_at, notes)
    VALUES 
        (prop3_id, 'Initial Walk-Through', 'service', 1, 'completed', NOW() - INTERVAL '14 days', 'Completed. Minor items only.'),
        (prop3_id, 'Return Work Order #1', 'service', 2, 'completed', NOW() - INTERVAL '7 days', 'All items resolved.');

    -- Property 4 phases (Pending)
    INSERT INTO phases (property_id, type, category, sort_order, status, scheduled_date, notes)
    VALUES 
        (prop4_id, 'Initial Walk-Through', 'service', 1, 'scheduled', CURRENT_DATE + INTERVAL '2 days', 'Scheduled for Thursday'),
        (prop4_id, 'Return Work Order #1', 'service', 2, 'not_started', NULL);

    -- Property 5 phases
    INSERT INTO phases (property_id, type, category, sort_order, status, completed_at, notes)
    VALUES 
        (prop5_id, 'Initial Walk-Through', 'service', 1, 'completed', NOW() - INTERVAL '5 days', 'Completed. Several items flagged.'),
        (prop5_id, 'Return Work Order #1', 'service', 2, 'in_progress', NULL, E'In progress:\n• Back door alignment\n• Dishwasher connection\n• Guest bath exhaust fan');

    -- Property 6 phases (Today's walk-through)
    INSERT INTO phases (property_id, type, category, sort_order, status, scheduled_date, notes)
    VALUES 
        (prop6_id, 'Initial Walk-Through', 'service', 1, 'scheduled', CURRENT_DATE, 'Scheduled for today'),
        (prop6_id, 'Return Work Order #1', 'service', 2, 'not_started', NULL);

    -- Property 7 phases (Multiple returns)
    INSERT INTO phases (property_id, type, category, sort_order, status, completed_at, notes)
    VALUES 
        (prop7_id, 'Initial Walk-Through', 'service', 1, 'completed', NOW() - INTERVAL '21 days', 'Completed.'),
        (prop7_id, 'Return Work Order #1', 'service', 2, 'completed', NOW() - INTERVAL '14 days', 'First return completed.'),
        (prop7_id, 'Return Work Order #2', 'service', 3, 'in_progress', NULL, E'Second return:\n• Warranty claim on range\n• Carpet seam repair');

    -- Property 8 phases (Warranty)
    INSERT INTO phases (property_id, type, category, sort_order, status, completed_at, notes)
    VALUES 
        (prop8_id, 'Initial Walk-Through', 'service', 1, 'completed', NOW() - INTERVAL '90 days', 'Completed.'),
        (prop8_id, 'Return Work Order #1', 'service', 2, 'completed', NOW() - INTERVAL '80 days', 'Completed.');

    RAISE NOTICE 'Test data created successfully!';
    RAISE NOTICE 'Created 8 customers and 8 properties with phases.';
    
END $$;
