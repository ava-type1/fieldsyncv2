# Stripe Integration Setup

This document describes how to configure Stripe billing for FieldSync.

## Overview

FieldSync uses Stripe for subscription billing with three tiers:
- **Solo** ($29/mo) - 1 user, 25 properties
- **Team** ($79/mo) - 5 users, 100 properties
- **Dealership** ($199/mo) - Unlimited users and properties

## Required Environment Variables

### Supabase Edge Functions

Set these in your Supabase project settings under Edge Functions > Secrets:

```bash
# Stripe API Key (from Stripe Dashboard > Developers > API keys)
STRIPE_SECRET_KEY=sk_live_xxx  # Use sk_test_xxx for testing

# Webhook signing secret (from Stripe Dashboard > Developers > Webhooks)
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Price IDs for each tier (from Stripe Dashboard > Products)
STRIPE_PRICE_SOLO=price_xxx
STRIPE_PRICE_TEAM=price_xxx
STRIPE_PRICE_DEALERSHIP=price_xxx
```

### Setting Secrets via CLI

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
supabase secrets set STRIPE_PRICE_SOLO=price_xxx
supabase secrets set STRIPE_PRICE_TEAM=price_xxx
supabase secrets set STRIPE_PRICE_DEALERSHIP=price_xxx
```

## Stripe Dashboard Setup

### 1. Create Products

In Stripe Dashboard > Products, create three products:

1. **FieldSync Solo**
   - Price: $29/month (recurring)
   - Copy the price ID (starts with `price_`)

2. **FieldSync Team**
   - Price: $79/month (recurring)
   - Copy the price ID

3. **FieldSync Dealership**
   - Price: $199/month (recurring)
   - Copy the price ID

### 2. Configure Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. Set the endpoint URL:
   ```
   https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Copy the "Signing secret" (starts with `whsec_`)

### 3. Configure Customer Portal

1. Go to Stripe Dashboard > Settings > Billing > Customer portal
2. Enable the portal
3. Configure allowed actions:
   - ✅ Update payment methods
   - ✅ View invoice history
   - ✅ Cancel subscriptions
   - ✅ Switch plans (add all three products)

## Database Migration

Run the migration to create the subscription tracking table:

```bash
supabase db push
# or apply manually
supabase migration up
```

This creates the `organization_subscriptions` table with:
- `stripe_customer_id` - Stripe Customer ID
- `stripe_subscription_id` - Stripe Subscription ID  
- `tier` - Current subscription tier
- `status` - Subscription status (active, past_due, etc.)
- `current_period_end` - When the current billing period ends
- `cancel_at_period_end` - Whether cancellation is pending

## Testing

### Test Mode

1. Use test API keys (starting with `sk_test_`)
2. Use Stripe test card numbers:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Requires auth: `4000 0025 0000 3155`

### Local Development

For local webhook testing, use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local Supabase
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

The CLI will output a webhook signing secret for local testing.

## Flow Overview

### Checkout Flow
1. User clicks "Upgrade" in billing settings
2. Client calls `createCheckoutSession()` 
3. Edge function creates Stripe Checkout session
4. User redirected to Stripe-hosted checkout page
5. After payment, Stripe sends `checkout.session.completed` webhook
6. Webhook handler updates `organization_subscriptions` table
7. User redirected back to billing settings

### Subscription Management
- **Upgrade/Downgrade**: Uses Stripe Customer Portal
- **Cancel**: Sets `cancel_at_period_end` to true
- **Resume**: Sets `cancel_at_period_end` to false

### Webhook Events
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record |
| `customer.subscription.updated` | Update tier/status |
| `customer.subscription.deleted` | Downgrade to free |
| `invoice.payment_failed` | Set status to past_due |
| `invoice.payment_succeeded` | Set status to active |

## Tier Limits

Feature availability by tier:

| Feature | Solo | Team | Dealership |
|---------|------|------|------------|
| Users | 1 | 5 | Unlimited |
| Properties | 25 | 100 | Unlimited |
| QuickBooks | ❌ | ✅ | ✅ |
| SMS Notifications | ✅ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ✅ | ✅ |

## Troubleshooting

### Webhook not receiving events
1. Check endpoint URL is correct
2. Verify webhook secret is set in Supabase secrets
3. Check Stripe Dashboard > Webhooks for failed deliveries

### Subscription not updating
1. Check Supabase Edge Function logs
2. Verify `organization_id` is in subscription metadata
3. Check RLS policies on `organization_subscriptions` table

### Customer portal not loading
1. Ensure portal is enabled in Stripe Dashboard
2. Verify customer has been created (has `stripe_customer_id`)
