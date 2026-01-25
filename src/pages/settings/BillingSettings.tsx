import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Check,
  AlertCircle,
  ExternalLink,
  FileText,
  Download,
  Loader2,
  Crown,
  Zap,
  Building2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  STRIPE_PRICES,
  PlanKey,
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus,
  getInvoiceHistory,
  cancelSubscription,
  resumeSubscription,
  formatPrice,
  getTierDisplayName,
  getTrialDaysRemaining,
  type SubscriptionStatus,
  type Invoice,
} from '../../lib/stripe';

const PLAN_ICONS = {
  solo: Zap,
  team: Crown,
  dealership: Building2,
};

export function BillingSettings() {
  const navigate = useNavigate();
  const { organization, hasPermission } = useAuthStore();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const canManageBilling = hasPermission('billing.manage');

  useEffect(() => {
    if (organization?.id) {
      loadBillingData();
    }
  }, [organization?.id]);

  async function loadBillingData() {
    setLoading(true);
    setError(null);

    try {
      const [subStatus, invoiceHistory] = await Promise.all([
        getSubscriptionStatus(organization!.id),
        getInvoiceHistory(organization!.id),
      ]);

      setSubscription(subStatus);
      setInvoices(invoiceHistory);
    } catch (err) {
      setError('Failed to load billing information');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planKey: PlanKey) {
    if (!canManageBilling || !organization) return;

    setActionLoading(planKey);
    setError(null);

    const result = await createCheckoutSession(
      STRIPE_PRICES[planKey].priceId,
      organization.id,
      `${window.location.origin}/settings/billing?success=true`,
      `${window.location.origin}/settings/billing?canceled=true`
    );

    if ('error' in result) {
      setError(result.error);
      setActionLoading(null);
    } else {
      window.location.href = result.url;
    }
  }

  async function handleManagePayment() {
    if (!canManageBilling || !organization) return;

    setActionLoading('portal');
    setError(null);

    const result = await createPortalSession(
      organization.id,
      `${window.location.origin}/settings/billing`
    );

    if ('error' in result) {
      setError(result.error);
      setActionLoading(null);
    } else {
      window.location.href = result.url;
    }
  }

  async function handleCancelSubscription() {
    if (!canManageBilling || !organization) return;

    setActionLoading('cancel');
    setError(null);

    const result = await cancelSubscription(organization.id);

    if (result.error) {
      setError(result.error);
    } else {
      setShowCancelConfirm(false);
      await loadBillingData();
    }

    setActionLoading(null);
  }

  async function handleResumeSubscription() {
    if (!canManageBilling || !organization) return;

    setActionLoading('resume');
    setError(null);

    const result = await resumeSubscription(organization.id);

    if (result.error) {
      setError(result.error);
    } else {
      await loadBillingData();
    }

    setActionLoading(null);
  }

  function getStatusBadge(status: SubscriptionStatus['status']) {
    const styles = {
      active: 'bg-green-100 text-green-700',
      trialing: 'bg-blue-100 text-blue-700',
      past_due: 'bg-yellow-100 text-yellow-700',
      canceled: 'bg-gray-100 text-gray-700',
      incomplete: 'bg-red-100 text-red-700',
    };

    const labels = {
      active: 'Active',
      trialing: 'Trial',
      past_due: 'Past Due',
      canceled: 'Canceled',
      incomplete: 'Incomplete',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free_trial';
  const isTrialing = subscription?.status === 'trialing';
  const trialDays = isTrialing ? getTrialDaysRemaining(subscription?.currentPeriodEnd || null) : 0;

  return (
    <div className="min-h-full bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/settings')} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Billing & Subscription</h1>
            <p className="text-sm text-gray-500">Manage your plan and payment methods</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-sm text-red-600 underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Current Plan */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500">Current Plan</p>
              <div className="flex items-center gap-2 mt-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {getTierDisplayName(currentTier)}
                </h2>
                {getStatusBadge(subscription?.status || 'trialing')}
              </div>
              {isTrialing && trialDays > 0 && (
                <p className="text-sm text-blue-600 mt-1">
                  {trialDays} days remaining in trial
                </p>
              )}
              {subscription?.cancelAtPeriodEnd && (
                <p className="text-sm text-yellow-600 mt-1">
                  Cancels on {new Date(subscription.currentPeriodEnd!).toLocaleDateString()}
                </p>
              )}
            </div>
            {subscription?.status === 'active' && !subscription.cancelAtPeriodEnd && (
              <p className="text-sm text-gray-500">
                Renews {subscription.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : 'N/A'}
              </p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {subscription?.stripeCustomerId && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleManagePayment}
                loading={actionLoading === 'portal'}
                disabled={!canManageBilling}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Payment
              </Button>
            )}
            {subscription?.cancelAtPeriodEnd ? (
              <Button
                variant="primary"
                size="sm"
                onClick={handleResumeSubscription}
                loading={actionLoading === 'resume'}
                disabled={!canManageBilling}
              >
                Resume Subscription
              </Button>
            ) : subscription?.status === 'active' && currentTier !== 'free_trial' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
                disabled={!canManageBilling}
                className="text-red-600 hover:bg-red-50"
              >
                Cancel Subscription
              </Button>
            )}
          </div>
        </Card>

        {/* Pricing Plans */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 px-1">
            {currentTier === 'free_trial' ? 'Choose a Plan' : 'Available Plans'}
          </h3>

          {(Object.entries(STRIPE_PRICES) as [PlanKey, typeof STRIPE_PRICES.solo][]).map(
            ([key, plan]) => {
              const isCurrentPlan = currentTier === key;
              const Icon = PLAN_ICONS[key];

              return (
                <Card
                  key={key}
                  className={`relative ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-4 bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded">
                      Current Plan
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <h4 className="text-lg font-semibold text-gray-900">{plan.name}</h4>
                        <span className="text-2xl font-bold text-gray-900">
                          {formatPrice(plan.price)}
                        </span>
                        <span className="text-sm text-gray-500">/{plan.interval}</span>
                      </div>

                      <ul className="mt-3 space-y-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {!isCurrentPlan && (
                        <Button
                          variant={key === 'dealership' ? 'primary' : 'secondary'}
                          size="sm"
                          className="mt-4"
                          onClick={() => handleUpgrade(key)}
                          loading={actionLoading === key}
                          disabled={!canManageBilling}
                        >
                          {currentTier === 'free_trial'
                            ? 'Start Plan'
                            : STRIPE_PRICES[key].price > (STRIPE_PRICES[currentTier as PlanKey]?.price || 0)
                            ? 'Upgrade'
                            : 'Switch Plan'}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            }
          )}

          {/* Enterprise CTA */}
          <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold">Enterprise</h4>
                <p className="text-sm text-gray-300 mt-1">
                  Custom solutions for large organizations with advanced needs
                </p>
                <ul className="mt-3 space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    Custom integrations
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    Dedicated account manager
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    SLA guarantees
                  </li>
                </ul>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 bg-white text-gray-900 hover:bg-gray-100"
                  onClick={() => window.open('mailto:sales@fieldsync.io?subject=Enterprise%20Inquiry', '_blank')}
                >
                  Contact Sales
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Invoice History */}
        {invoices.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 px-1">Invoice History</h3>
            <Card padding="none">
              <div className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Invoice #{invoice.number}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : invoice.status === 'open'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {invoice.status}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatPrice(invoice.amount / 100, invoice.currency)}
                      </span>
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-gray-100 rounded-lg"
                        >
                          <Download className="w-4 h-4 text-gray-600" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Help Link */}
        <div className="text-center pt-4">
          <a
            href="https://fieldsync.io/billing-help"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            Need help with billing?
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-md w-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mt-4">Cancel Subscription?</h3>
              <p className="text-sm text-gray-600 mt-2">
                Your subscription will remain active until{' '}
                {subscription?.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : 'the end of your billing period'}
                . After that, you'll lose access to premium features.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep Subscription
              </Button>
              <Button
                variant="danger"
                fullWidth
                onClick={handleCancelSubscription}
                loading={actionLoading === 'cancel'}
              >
                Yes, Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
