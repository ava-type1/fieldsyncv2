/**
 * Stripe Billing Integration
 *
 * Client-side utilities for Stripe subscription management.
 * All sensitive operations are handled via Supabase Edge Functions.
 *
 * Required env vars (in Supabase Edge Functions):
 * - STRIPE_SECRET_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - STRIPE_PRICE_SOLO
 * - STRIPE_PRICE_TEAM
 * - STRIPE_PRICE_DEALERSHIP
 */

import { supabase } from './supabase';
import type { SubscriptionTier } from '../types';

// Pricing constants with placeholder IDs
export const STRIPE_PRICES = {
  solo: {
    priceId: 'price_solo_placeholder', // Replace with actual Stripe price ID
    name: 'Solo',
    price: 29,
    interval: 'month' as const,
    features: [
      '1 user',
      'Up to 25 active properties',
      'Basic reporting',
      'Email support',
    ],
    limits: {
      users: 1,
      properties: 25,
      storage: 5, // GB
    },
  },
  team: {
    priceId: 'price_team_placeholder', // Replace with actual Stripe price ID
    name: 'Team',
    price: 79,
    interval: 'month' as const,
    features: [
      'Up to 5 users',
      'Up to 100 active properties',
      'Advanced reporting',
      'QuickBooks integration',
      'Priority support',
    ],
    limits: {
      users: 5,
      properties: 100,
      storage: 25, // GB
    },
  },
  dealership: {
    priceId: 'price_dealership_placeholder', // Replace with actual Stripe price ID
    name: 'Dealership',
    price: 199,
    interval: 'month' as const,
    features: [
      'Unlimited users',
      'Unlimited properties',
      'Multi-location support',
      'Custom reporting',
      'API access',
      'Dedicated support',
      'White-label options',
    ],
    limits: {
      users: -1, // Unlimited
      properties: -1, // Unlimited
      storage: 100, // GB
    },
  },
} as const;

export type PlanKey = keyof typeof STRIPE_PRICES;

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  createdAt: string;
  pdfUrl: string | null;
  hostedInvoiceUrl: string | null;
}

/**
 * Create a Stripe Checkout session for upgrading/subscribing
 */
export async function createCheckoutSession(
  priceId: string,
  organizationId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string } | { error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'create_checkout',
        priceId,
        organizationId,
        successUrl,
        cancelUrl,
      },
    });

    if (error) {
      console.error('Checkout session error:', error);
      return { error: error.message || 'Failed to create checkout session' };
    }

    return { url: data.url };
  } catch (err) {
    console.error('Checkout session error:', err);
    return { error: 'Failed to create checkout session' };
  }
}

/**
 * Create a Stripe Customer Portal session for managing subscription
 */
export async function createPortalSession(
  organizationId: string,
  returnUrl: string
): Promise<{ url: string } | { error: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'create_portal',
        organizationId,
        returnUrl,
      },
    });

    if (error) {
      console.error('Portal session error:', error);
      return { error: error.message || 'Failed to create portal session' };
    }

    return { url: data.url };
  } catch (err) {
    console.error('Portal session error:', err);
    return { error: 'Failed to create portal session' };
  }
}

/**
 * Get current subscription status for an organization
 */
export async function getSubscriptionStatus(
  organizationId: string
): Promise<SubscriptionStatus | null> {
  try {
    const { data, error } = await supabase
      .from('organization_subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      console.error('Error fetching subscription:', error);
      return null;
    }

    if (!data) {
      // Default to free trial if no subscription record
      return {
        tier: 'free_trial',
        status: 'trialing',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
    }

    return {
      tier: data.tier,
      status: data.status,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
    };
  } catch (err) {
    console.error('Error fetching subscription status:', err);
    return null;
  }
}

/**
 * Get invoice history for an organization
 */
export async function getInvoiceHistory(organizationId: string): Promise<Invoice[]> {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'get_invoices',
        organizationId,
      },
    });

    if (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }

    return data.invoices || [];
  } catch (err) {
    console.error('Error fetching invoices:', err);
    return [];
  }
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'cancel_subscription',
        organizationId,
      },
    });

    if (error) {
      console.error('Cancel subscription error:', error);
      return { success: false, error: error.message || 'Failed to cancel subscription' };
    }

    return { success: true };
  } catch (err) {
    console.error('Cancel subscription error:', err);
    return { success: false, error: 'Failed to cancel subscription' };
  }
}

/**
 * Resume a canceled subscription (before period end)
 */
export async function resumeSubscription(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'resume_subscription',
        organizationId,
      },
    });

    if (error) {
      console.error('Resume subscription error:', error);
      return { success: false, error: error.message || 'Failed to resume subscription' };
    }

    return { success: true };
  } catch (err) {
    console.error('Resume subscription error:', err);
    return { success: false, error: 'Failed to resume subscription' };
  }
}

/**
 * Check if organization can perform an action based on tier limits
 */
export function checkTierLimit(
  tier: SubscriptionTier,
  limitType: 'users' | 'properties' | 'storage',
  currentCount: number
): { allowed: boolean; limit: number; remaining: number } {
  // Free trial gets team-level limits for 14 days
  const effectiveTier = tier === 'free_trial' ? 'team' : tier;

  // Enterprise has no limits
  if (effectiveTier === 'enterprise') {
    return { allowed: true, limit: -1, remaining: -1 };
  }

  const planConfig = STRIPE_PRICES[effectiveTier as PlanKey];
  if (!planConfig) {
    // Unknown tier, deny by default
    return { allowed: false, limit: 0, remaining: 0 };
  }

  const limit = planConfig.limits[limitType];

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1, remaining: -1 };
  }

  const remaining = Math.max(0, limit - currentCount);
  return {
    allowed: currentCount < limit,
    limit,
    remaining,
  };
}

/**
 * Get the recommended upgrade tier based on current usage
 */
export function getRecommendedUpgrade(
  currentTier: SubscriptionTier,
  usage: { users: number; properties: number; storage: number }
): PlanKey | null {
  const tiers: PlanKey[] = ['solo', 'team', 'dealership'];
  const currentIndex = currentTier === 'free_trial' ? -1 : tiers.indexOf(currentTier as PlanKey);

  for (let i = currentIndex + 1; i < tiers.length; i++) {
    const tier = tiers[i];
    const limits = STRIPE_PRICES[tier].limits;

    const usersFit = limits.users === -1 || usage.users <= limits.users;
    const propertiesFit = limits.properties === -1 || usage.properties <= limits.properties;
    const storageFit = limits.storage === -1 || usage.storage <= limits.storage;

    if (usersFit && propertiesFit && storageFit) {
      return tier;
    }
  }

  return 'dealership'; // Default to highest tier if nothing else fits
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  switch (tier) {
    case 'free_trial':
      return 'Free Trial';
    case 'solo':
      return 'Solo';
    case 'team':
      return 'Team';
    case 'dealership':
      return 'Dealership';
    case 'enterprise':
      return 'Enterprise';
    default:
      return tier;
  }
}

/**
 * Check if tier is a paid tier
 */
export function isPaidTier(tier: SubscriptionTier): boolean {
  return ['solo', 'team', 'dealership', 'enterprise'].includes(tier);
}

/**
 * Get days remaining in trial
 */
export function getTrialDaysRemaining(trialEndDate: string | null): number {
  if (!trialEndDate) return 0;
  const end = new Date(trialEndDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
