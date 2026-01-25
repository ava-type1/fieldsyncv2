/**
 * Subscription Hook
 *
 * Provides subscription status and tier-gating utilities for components.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  getSubscriptionStatus,
  checkTierLimit,
  STRIPE_PRICES,
  type SubscriptionStatus,
  type PlanKey,
} from '../lib/stripe';
import type { SubscriptionTier } from '../types';

interface UseSubscriptionReturn {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // Tier checking
  tier: SubscriptionTier;
  isTrialing: boolean;
  isPaid: boolean;
  isCanceled: boolean;

  // Limit checking
  canAddUser: (currentCount: number) => boolean;
  canAddProperty: (currentCount: number) => boolean;
  getUserLimit: () => number;
  getPropertyLimit: () => number;
  getStorageLimit: () => number;

  // Feature gating
  hasFeature: (feature: SubscriptionFeature) => boolean;
}

export type SubscriptionFeature =
  | 'quickbooks_integration'
  | 'api_access'
  | 'custom_reports'
  | 'multi_location'
  | 'white_label'
  | 'priority_support'
  | 'sms_notifications';

// Feature availability by tier
const TIER_FEATURES: Record<SubscriptionTier, SubscriptionFeature[]> = {
  free_trial: [
    'quickbooks_integration',
    'sms_notifications',
  ],
  solo: [
    'sms_notifications',
  ],
  team: [
    'quickbooks_integration',
    'sms_notifications',
    'priority_support',
  ],
  dealership: [
    'quickbooks_integration',
    'api_access',
    'custom_reports',
    'multi_location',
    'priority_support',
    'sms_notifications',
  ],
  enterprise: [
    'quickbooks_integration',
    'api_access',
    'custom_reports',
    'multi_location',
    'white_label',
    'priority_support',
    'sms_notifications',
  ],
};

export function useSubscription(): UseSubscriptionReturn {
  const { organization } = useAuthStore();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const status = await getSubscriptionStatus(organization.id);
      setSubscription(status);
    } catch (err) {
      setError('Failed to load subscription status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const tier = subscription?.tier || organization?.subscription || 'free_trial';
  const isTrialing = subscription?.status === 'trialing';
  const isPaid = ['solo', 'team', 'dealership', 'enterprise'].includes(tier);
  const isCanceled = subscription?.cancelAtPeriodEnd || subscription?.status === 'canceled';

  const canAddUser = useCallback(
    (currentCount: number) => {
      const result = checkTierLimit(tier, 'users', currentCount);
      return result.allowed;
    },
    [tier]
  );

  const canAddProperty = useCallback(
    (currentCount: number) => {
      const result = checkTierLimit(tier, 'properties', currentCount);
      return result.allowed;
    },
    [tier]
  );

  const getUserLimit = useCallback(() => {
    const effectiveTier = tier === 'free_trial' ? 'team' : tier;
    if (effectiveTier === 'enterprise') return -1;
    return STRIPE_PRICES[effectiveTier as PlanKey]?.limits.users || 1;
  }, [tier]);

  const getPropertyLimit = useCallback(() => {
    const effectiveTier = tier === 'free_trial' ? 'team' : tier;
    if (effectiveTier === 'enterprise') return -1;
    return STRIPE_PRICES[effectiveTier as PlanKey]?.limits.properties || 25;
  }, [tier]);

  const getStorageLimit = useCallback(() => {
    const effectiveTier = tier === 'free_trial' ? 'team' : tier;
    if (effectiveTier === 'enterprise') return -1;
    return STRIPE_PRICES[effectiveTier as PlanKey]?.limits.storage || 5;
  }, [tier]);

  const hasFeature = useCallback(
    (feature: SubscriptionFeature) => {
      const features = TIER_FEATURES[tier] || [];
      return features.includes(feature);
    },
    [tier]
  );

  return {
    subscription,
    loading,
    error,
    refresh,
    tier,
    isTrialing,
    isPaid,
    isCanceled,
    canAddUser,
    canAddProperty,
    getUserLimit,
    getPropertyLimit,
    getStorageLimit,
    hasFeature,
  };
}

/**
 * Simple hook for checking a single feature gate
 */
export function useFeatureGate(feature: SubscriptionFeature): {
  hasAccess: boolean;
  loading: boolean;
  tier: SubscriptionTier;
} {
  const { hasFeature, loading, tier } = useSubscription();

  return {
    hasAccess: hasFeature(feature),
    loading,
    tier,
  };
}

/**
 * Simple hook for checking tier limits
 */
export function useTierLimit(
  limitType: 'users' | 'properties' | 'storage',
  currentCount: number
): {
  allowed: boolean;
  limit: number;
  remaining: number;
  loading: boolean;
} {
  const { tier, loading } = useSubscription();
  const result = checkTierLimit(tier, limitType, currentCount);

  return {
    ...result,
    loading,
  };
}
