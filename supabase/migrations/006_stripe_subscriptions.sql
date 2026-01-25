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
