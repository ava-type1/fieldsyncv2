/**
 * Stripe Webhook Edge Function
 *
 * Handles Stripe webhook events to sync subscription state.
 *
 * Required env vars:
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.12.0?target=deno';

// Price ID to tier mapping - configured via env vars
function getPriceTierMap(): Record<string, string> {
  return {
    [Deno.env.get('STRIPE_PRICE_SOLO') || 'price_solo']: 'solo',
    [Deno.env.get('STRIPE_PRICE_TEAM') || 'price_team']: 'team',
    [Deno.env.get('STRIPE_PRICE_DEALERSHIP') || 'price_dealership']: 'dealership',
  };
}

serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!stripeKey || !webhookSecret) {
    console.error('Missing Stripe configuration');
    return new Response('Webhook not configured', { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify webhook signature
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`Processing webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(supabase, stripe, session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(supabase, subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(supabase, subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(supabase, invoice);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(supabase, invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err) {
    console.error('Error processing webhook:', err);
    return new Response(`Webhook Error: ${err.message}`, { status: 500 });
  }
});

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  console.log('Checkout completed:', session.id);

  // Get subscription details
  if (session.mode !== 'subscription' || !session.subscription) {
    console.log('Not a subscription checkout');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const organizationId = subscription.metadata.organization_id;

  if (!organizationId) {
    console.error('No organization_id in subscription metadata');
    return;
  }

  // Determine tier from price
  const priceId = subscription.items.data[0]?.price.id;
  const priceTierMap = getPriceTierMap();
  const tier = priceTierMap[priceId] || 'solo';

  // Update subscription record
  const { error } = await supabase
    .from('organization_subscriptions')
    .upsert({
      organization_id: organizationId,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscription.id,
      tier,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  // Update organization's subscription tier
  await supabase
    .from('organizations')
    .update({ subscription: tier })
    .eq('id', organizationId);

  console.log(`Subscription created for org ${organizationId}: ${tier}`);
}

async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  console.log('Subscription updated:', subscription.id);

  const organizationId = subscription.metadata.organization_id;

  if (!organizationId) {
    // Try to find by customer ID
    const { data: subRecord } = await supabase
      .from('organization_subscriptions')
      .select('organization_id')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (!subRecord) {
      console.error('Could not find organization for subscription:', subscription.id);
      return;
    }
  }

  // Determine tier from price
  const priceId = subscription.items.data[0]?.price.id;
  const priceTierMap = getPriceTierMap();
  const tier = priceTierMap[priceId] || 'solo';

  const orgId = organizationId || (await supabase
    .from('organization_subscriptions')
    .select('organization_id')
    .eq('stripe_subscription_id', subscription.id)
    .single()
    .then(r => r.data?.organization_id));

  if (!orgId) {
    console.error('Could not determine organization ID');
    return;
  }

  // Update subscription record
  const { error } = await supabase
    .from('organization_subscriptions')
    .update({
      tier,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  // Update organization's subscription tier
  await supabase
    .from('organizations')
    .update({ subscription: tier })
    .eq('id', orgId);

  console.log(`Subscription updated for org ${orgId}: ${tier}, status: ${subscription.status}`);
}

async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createClient>,
  subscription: Stripe.Subscription
) {
  console.log('Subscription deleted:', subscription.id);

  // Find organization
  const { data: subRecord } = await supabase
    .from('organization_subscriptions')
    .select('organization_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!subRecord) {
    console.error('Could not find subscription record for:', subscription.id);
    return;
  }

  // Update subscription record
  const { error } = await supabase
    .from('organization_subscriptions')
    .update({
      status: 'canceled',
      tier: 'free_trial', // Downgrade to free
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  // Downgrade organization
  await supabase
    .from('organizations')
    .update({ subscription: 'free_trial' })
    .eq('id', subRecord.organization_id);

  console.log(`Subscription canceled for org ${subRecord.organization_id}`);
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  console.log('Payment failed for invoice:', invoice.id);

  if (!invoice.subscription) return;

  // Update subscription status
  const { error } = await supabase
    .from('organization_subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', invoice.subscription as string);

  if (error) {
    console.error('Error updating subscription status:', error);
  }

  // TODO: Send notification to organization admins about failed payment
}

async function handlePaymentSucceeded(
  supabase: ReturnType<typeof createClient>,
  invoice: Stripe.Invoice
) {
  console.log('Payment succeeded for invoice:', invoice.id);

  if (!invoice.subscription) return;

  // Ensure subscription status is active after successful payment
  const { error } = await supabase
    .from('organization_subscriptions')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', invoice.subscription as string);

  if (error) {
    console.error('Error updating subscription status:', error);
  }
}
