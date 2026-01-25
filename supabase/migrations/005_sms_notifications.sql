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
