# FieldSync Setup Guide

Complete guide to setting up FieldSync for production.

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

### Run Migrations

In the Supabase SQL Editor, run these migrations in order:

```sql
-- 001_initial_schema.sql
-- 002_add_photos.sql
-- 003_add_sync_support.sql
-- 004_add_portal_code.sql
-- 005_sms_notifications.sql
-- 006_integrations.sql
```

Or use the Supabase CLI:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

### Enable Storage

1. Go to Storage in Supabase dashboard
2. Create buckets:
   - `photos` - for property photos
   - `signatures` - for signature images
   - `reports` - for generated PDFs
3. Set public access for `photos` bucket (or configure signed URLs)

### Configure Auth

1. Go to Authentication > Providers
2. Enable Email provider
3. (Optional) Enable Google, Apple for OAuth

## 2. Edge Functions

Deploy Supabase Edge Functions for server-side integrations:

```bash
# Deploy all functions
npx supabase functions deploy quickbooks-auth
npx supabase functions deploy quickbooks-sync
npx supabase functions deploy stripe-checkout
npx supabase functions deploy stripe-webhook
npx supabase functions deploy send-sms
```

### Set Function Secrets

```bash
# QuickBooks
npx supabase secrets set QUICKBOOKS_CLIENT_ID=xxx
npx supabase secrets set QUICKBOOKS_CLIENT_SECRET=xxx
npx supabase secrets set QUICKBOOKS_REDIRECT_URI=https://yourapp.com/settings/quickbooks

# Stripe
npx supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
npx supabase secrets set STRIPE_PRICE_SOLO=price_xxx
npx supabase secrets set STRIPE_PRICE_TEAM=price_xxx
npx supabase secrets set STRIPE_PRICE_DEALERSHIP=price_xxx

# Twilio
npx supabase secrets set TWILIO_ACCOUNT_SID=ACxxx
npx supabase secrets set TWILIO_AUTH_TOKEN=xxx
npx supabase secrets set TWILIO_PHONE_NUMBER=+1234567890
```

## 3. QuickBooks Setup

1. Go to [developer.intuit.com](https://developer.intuit.com)
2. Create an app with these scopes:
   - `com.intuit.quickbooks.accounting`
   - `openid`, `profile`, `email`
3. Add redirect URI: `https://yourapp.com/settings/quickbooks`
4. Copy Client ID and Client Secret

## 4. Stripe Setup

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Create Products for each tier:
   - Solo ($29/mo)
   - Team ($79/mo)
   - Dealership ($199/mo)
3. Note the Price IDs (price_xxx)
4. Create a webhook endpoint: `https://your-supabase-url/functions/v1/stripe-webhook`
5. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

## 5. Twilio Setup

1. Go to [twilio.com/console](https://www.twilio.com/console)
2. Get your Account SID and Auth Token
3. Buy a phone number for sending SMS
4. (Optional) Set up Messaging Service for higher throughput

## 6. Frontend Deployment

### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login and deploy
vercel login
vercel

# Set environment variables in Vercel dashboard
```

### Netlify

```bash
# Build
npm run build

# Deploy dist folder to Netlify
```

### Docker

```bash
# Build image
docker build -t fieldsync .

# Run container
docker run -p 3000:3000 fieldsync
```

## 7. Custom Domain

1. Add your domain in hosting provider (Vercel/Netlify)
2. Update DNS records
3. Update environment variables:
   - `VITE_QUICKBOOKS_REDIRECT_URI`
4. Update QuickBooks app redirect URI
5. Update Stripe webhook URL

## 8. Production Checklist

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Storage buckets created with correct policies
- [ ] Edge functions deployed
- [ ] Secrets configured in Supabase
- [ ] QuickBooks redirect URI updated
- [ ] Stripe webhook configured
- [ ] Custom domain configured
- [ ] SSL enabled
- [ ] Error monitoring set up (Sentry recommended)
- [ ] Analytics configured (optional)

## Troubleshooting

### "QuickBooks not connected" error
- Verify QUICKBOOKS_CLIENT_ID is set in `.env`
- Check redirect URI matches exactly in QuickBooks app settings

### SMS not sending
- Verify Twilio credentials in Supabase secrets
- Check phone number format (+1XXXXXXXXXX)
- Review Twilio console for errors

### Offline sync not working
- Clear IndexedDB in browser dev tools
- Check Service Worker is registered
- Verify Supabase URL is correct

### Photos not uploading
- Check storage bucket exists and policies are set
- Verify file size under Supabase limits (50MB default)
- Check browser console for CORS errors
