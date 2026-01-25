/**
 * Stripe Checkout Edge Function
 *
 * Handles checkout session creation and customer portal access.
 *
 * Required env vars:
 * - STRIPE_SECRET_KEY
 * - STRIPE_PRICE_SOLO
 * - STRIPE_PRICE_TEAM
 * - STRIPE_PRICE_DEALERSHIP
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.12.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, organizationId, priceId, successUrl, cancelUrl, returnUrl } = await req.json();

    // Get organization and existing customer
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, primary_email')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: 'Organization not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing subscription record
    const { data: subRecord } = await supabase
      .from('organization_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('organization_id', organizationId)
      .single();

    let customerId = subRecord?.stripe_customer_id;

    // Create customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.primary_email,
        name: org.name,
        metadata: {
          organization_id: organizationId,
        },
      });
      customerId = customer.id;

      // Store customer ID
      await supabase
        .from('organization_subscriptions')
        .upsert({
          organization_id: organizationId,
          stripe_customer_id: customerId,
          tier: 'free_trial',
          status: 'trialing',
        });
    }

    if (action === 'create_checkout') {
      // Map placeholder price IDs to actual env-configured ones
      let actualPriceId = priceId;
      if (priceId === 'price_solo_placeholder') {
        actualPriceId = Deno.env.get('STRIPE_PRICE_SOLO') || priceId;
      } else if (priceId === 'price_team_placeholder') {
        actualPriceId = Deno.env.get('STRIPE_PRICE_TEAM') || priceId;
      } else if (priceId === 'price_dealership_placeholder') {
        actualPriceId = Deno.env.get('STRIPE_PRICE_DEALERSHIP') || priceId;
      }

      // If customer already has a subscription, create a billing portal session instead
      if (subRecord?.stripe_subscription_id) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: successUrl,
          flow_data: {
            type: 'subscription_update_confirm',
            subscription_update_confirm: {
              subscription: subRecord.stripe_subscription_id,
              items: [
                {
                  id: (await stripe.subscriptions.retrieve(subRecord.stripe_subscription_id))
                    .items.data[0].id,
                  price: actualPriceId,
                },
              ],
            },
          },
        });

        return new Response(
          JSON.stringify({ url: portalSession.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create checkout session for new subscription
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: actualPriceId,
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            organization_id: organizationId,
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
          address: 'auto',
          name: 'auto',
        },
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'create_portal') {
      if (!customerId) {
        return new Response(
          JSON.stringify({ error: 'No billing account found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return new Response(
        JSON.stringify({ url: session.url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'get_invoices') {
      if (!customerId) {
        return new Response(
          JSON.stringify({ invoices: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: 12,
      });

      const formattedInvoices = invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number,
        amount: inv.amount_paid || inv.amount_due,
        currency: inv.currency,
        status: inv.status,
        createdAt: new Date(inv.created * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf,
        hostedInvoiceUrl: inv.hosted_invoice_url,
      }));

      return new Response(
        JSON.stringify({ invoices: formattedInvoices }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'cancel_subscription') {
      if (!subRecord?.stripe_subscription_id) {
        return new Response(
          JSON.stringify({ error: 'No active subscription found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await stripe.subscriptions.update(subRecord.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      // Update local record
      await supabase
        .from('organization_subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('organization_id', organizationId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'resume_subscription') {
      if (!subRecord?.stripe_subscription_id) {
        return new Response(
          JSON.stringify({ error: 'No subscription found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await stripe.subscriptions.update(subRecord.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      // Update local record
      await supabase
        .from('organization_subscriptions')
        .update({ cancel_at_period_end: false })
        .eq('organization_id', organizationId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (err) {
    console.error('Stripe checkout error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
