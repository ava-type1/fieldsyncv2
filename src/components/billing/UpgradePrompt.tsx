/**
 * Upgrade Prompt Component
 *
 * Shows contextual upgrade prompts when users hit tier limits.
 */

import { useNavigate } from 'react-router-dom';
import { Crown, Zap, AlertTriangle, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { STRIPE_PRICES, getTierDisplayName, formatPrice, type PlanKey } from '../../lib/stripe';
import type { SubscriptionTier } from '../../types';

interface UpgradePromptProps {
  currentTier: SubscriptionTier;
  limitType: 'users' | 'properties' | 'storage' | 'feature';
  featureName?: string;
  onDismiss?: () => void;
  inline?: boolean;
}

export function UpgradePrompt({
  currentTier,
  limitType,
  featureName,
  onDismiss,
  inline = false,
}: UpgradePromptProps) {
  const navigate = useNavigate();

  // Determine recommended upgrade
  const getRecommendedPlan = (): PlanKey => {
    if (currentTier === 'free_trial' || currentTier === 'solo') {
      return 'team';
    }
    return 'dealership';
  };

  const recommendedPlan = getRecommendedPlan();
  const planDetails = STRIPE_PRICES[recommendedPlan];

  const getMessage = () => {
    switch (limitType) {
      case 'users':
        return `You've reached the user limit for your ${getTierDisplayName(currentTier)} plan.`;
      case 'properties':
        return `You've reached the property limit for your ${getTierDisplayName(currentTier)} plan.`;
      case 'storage':
        return `You're running low on storage space.`;
      case 'feature':
        return `${featureName || 'This feature'} requires a higher plan.`;
      default:
        return 'Upgrade to unlock more features.';
    }
  };

  if (inline) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{getMessage()}</p>
            <p className="text-sm text-gray-600 mt-1">
              Upgrade to {planDetails.name} for {formatPrice(planDetails.price)}/month
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => navigate('/settings/billing')}
            >
              View Plans
            </Button>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Crown className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mt-4">
          Upgrade Your Plan
        </h3>
        <p className="text-sm text-gray-600 mt-2">{getMessage()}</p>
        
        <div className="mt-6 p-4 bg-white rounded-lg border border-blue-100">
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-lg font-bold text-gray-900">
              {planDetails.name}
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {formatPrice(planDetails.price)}
            <span className="text-sm font-normal text-gray-500">/month</span>
          </p>
          <ul className="mt-4 space-y-2 text-left">
            {planDetails.features.slice(0, 3).map((feature, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 mt-6">
          {onDismiss && (
            <Button variant="secondary" fullWidth onClick={onDismiss}>
              Maybe Later
            </Button>
          )}
          <Button fullWidth onClick={() => navigate('/settings/billing')}>
            Upgrade Now
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface FeatureGateProps {
  feature: string;
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  children: React.ReactNode;
}

/**
 * Wraps content that requires a specific tier.
 * Shows upgrade prompt if user doesn't have access.
 */
export function FeatureGate({
  feature,
  currentTier,
  requiredTier,
  children,
}: FeatureGateProps) {
  const tierOrder: SubscriptionTier[] = ['free_trial', 'solo', 'team', 'dealership', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const requiredIndex = tierOrder.indexOf(requiredTier);

  if (currentIndex >= requiredIndex) {
    return <>{children}</>;
  }

  return (
    <UpgradePrompt
      currentTier={currentTier}
      limitType="feature"
      featureName={feature}
      inline
    />
  );
}

interface LimitWarningProps {
  limitType: 'users' | 'properties';
  current: number;
  limit: number;
  tier: SubscriptionTier;
}

/**
 * Shows a warning banner when approaching limits
 */
export function LimitWarning({ limitType, current, limit, tier }: LimitWarningProps) {
  const navigate = useNavigate();
  const percentage = limit > 0 ? (current / limit) * 100 : 0;

  // Only show warning when at 80% or more of limit
  if (percentage < 80 || limit === -1) {
    return null;
  }

  const isAtLimit = current >= limit;

  return (
    <div
      className={`p-3 rounded-lg flex items-center gap-3 ${
        isAtLimit
          ? 'bg-red-50 border border-red-200'
          : 'bg-yellow-50 border border-yellow-200'
      }`}
    >
      <AlertTriangle
        className={`w-5 h-5 flex-shrink-0 ${
          isAtLimit ? 'text-red-500' : 'text-yellow-500'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            isAtLimit ? 'text-red-700' : 'text-yellow-700'
          }`}
        >
          {isAtLimit
            ? `${limitType === 'users' ? 'User' : 'Property'} limit reached`
            : `${current} of ${limit} ${limitType} used`}
        </p>
      </div>
      <Button
        size="sm"
        variant={isAtLimit ? 'primary' : 'secondary'}
        onClick={() => navigate('/settings/billing')}
      >
        Upgrade
      </Button>
    </div>
  );
}
