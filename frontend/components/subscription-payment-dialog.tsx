'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_PAID_TIER,
  PAID_PLAN_ORDER,
  SUBSCRIPTION_PLANS,
  formatPlanLimit,
  formatPlanRate,
  type SubscriptionPlan,
  type SubscriptionTier,
} from '@/lib/subscriptionPlans';

interface SubscriptionPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete: (paymentIntentId: string) => void;
  onCancel: () => void;
  currentTier?: SubscriptionTier;
  currentLimit?: number | null;
  currentCount?: number | null;
  initialTier?: SubscriptionTier | null;
}

function PaymentForm({
  onPaymentComplete,
  onCancel,
  submitLabel,
}: {
  onPaymentComplete: (paymentIntentId: string) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) {
      setError('Payment system not ready');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Payment form error');
        setProcessing(false);
        return;
      }

      // Get payment intent client secret from the element
      const paymentElement = elements.getElement(PaymentElement);
      if (!paymentElement) {
        setError('Payment element not found');
        setProcessing(false);
        return;
      }

      // Confirm payment
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onPaymentComplete(paymentIntent.id);
      }
    } catch (err: unknown) {
      console.error('Error processing payment:', err);
      const message = err instanceof Error ? err.message : 'Payment processing failed';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <PaymentElement />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={processing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={processing || !stripe}
          className="flex-1"
        >
          {processing ? 'Processing...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function SubscriptionPaymentDialog({
  open,
  onOpenChange,
  onPaymentComplete,
  onCancel,
  currentTier,
  currentLimit,
  currentCount,
  initialTier = null,
}: SubscriptionPaymentDialogProps) {
  const [stripePromise, setStripePromise] = useState<Stripe | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>(initialTier ?? DEFAULT_PAID_TIER);
  const [activePlan, setActivePlan] = useState<{
    tier: SubscriptionTier;
    name: string;
    amountCents: number;
    billingInterval: 'month' | 'year';
    maxIndexedItems: number | null;
  } | null>(null);

  // Initialize Stripe
  useEffect(() => {
    const initStripe = async () => {
      if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
        setError('Stripe not configured. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.');
        return;
      }
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      setStripePromise(stripe);
    };
    void initStripe();
  }, []);

  const createPaymentIntent = useCallback(async (tier: SubscriptionTier) => {
    try {
      setLoading(true);
      setError(null);
      setClientSecret(null);

      const { apiClient } = await import('@/lib/api');
      const paymentData = await apiClient.createSubscriptionPaymentIntent(tier);

      setClientSecret(paymentData.clientSecret);
      setActivePlan({
        tier: paymentData.subscriptionTier ?? tier,
        name: paymentData.plan.name,
        amountCents: paymentData.plan.amountCents,
        billingInterval: paymentData.plan.billingInterval,
        maxIndexedItems: paymentData.plan.maxIndexedItems,
      });
    } catch (err: unknown) {
      console.error('Error creating payment intent:', err);
      const message = err instanceof Error ? err.message : 'Failed to initialize payment';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create payment intent when dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialTier) {
      setSelectedTier(initialTier);
      return;
    }

    const nextTier = (() => {
      if (currentTier === 'pro' || currentTier === 'pro_annual') {
        return currentTier;
      }
      return DEFAULT_PAID_TIER;
    })();
    setSelectedTier(nextTier);
  }, [currentTier, initialTier, open]);

  useEffect(() => {
    if (open && stripePromise) {
      void createPaymentIntent(selectedTier);
    }
  }, [createPaymentIntent, open, selectedTier, stripePromise]);

  const handlePlanSelect = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
  };

  const selectedPlan: SubscriptionPlan = (() => {
    const basePlan = SUBSCRIPTION_PLANS[selectedTier];
    if (activePlan && activePlan.tier === selectedTier) {
      return {
        ...basePlan,
        priceCents: activePlan.amountCents,
        billingInterval: activePlan.billingInterval,
        maxIndexedItems: activePlan.maxIndexedItems,
      };
    }
    return basePlan;
  })();

  const currentPlan = SUBSCRIPTION_PLANS[currentTier ?? 'free'];
  const submitLabel = `Subscribe ${formatPlanRate(selectedPlan)}`;

  const handlePaymentComplete = (id: string) => {
    onPaymentComplete(id);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Item Limit Exceeded</DialogTitle>
          <DialogDescription>
            Choose a plan to expand your indexed item capacity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg space-y-2">
            <p className="text-sm font-medium">
              You&apos;re currently on the {currentPlan.name} plan
              {typeof currentLimit === 'number'
                ? Number.isFinite(currentLimit)
                  ? ` (up to ${currentLimit.toLocaleString()} items)`
                  : ' (unlimited items)'
                : ''}.
            </p>
            {typeof currentCount === 'number' && (
              <p className="text-sm">
                You have {currentCount.toLocaleString()} indexed item{currentCount === 1 ? '' : 's'} so far.
              </p>
            )}
            <p className="text-sm">
              Select the plan that matches how many items you expect to manage.
            </p>
          </div>

          <div className="grid gap-3">
            {PAID_PLAN_ORDER.map((tier) => {
              const plan = SUBSCRIPTION_PLANS[tier];
              const selected = selectedTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => handlePlanSelect(tier)}
                  className={`w-full rounded-lg border p-4 text-left transition ${
                    selected
                      ? 'border-blue-500 bg-blue-50 shadow-xs'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
                      <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatPlanRate(plan)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatPlanLimit(plan)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Selected plan:</span>
              <span className="font-medium text-gray-900">{selectedPlan.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Price:</span>
              <span className="font-bold text-lg text-gray-900">
                {formatPlanRate(selectedPlan)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Indexed item capacity:</span>
              <span className="text-sm font-medium text-gray-900">
                {formatPlanLimit(selectedPlan)}
              </span>
            </div>
          </div>

          {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded text-sm">
              <strong>Note:</strong> In development mode, you&apos;ll need to manually enter card details.
              Use Stripe test card: <code className="bg-blue-100 px-1 rounded">4242 4242 4242 4242</code>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600">Initializing payment...</p>
            </div>
          )}

          {stripePromise && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                },
                loader: 'auto',
              }}
            >
              <PaymentForm
                onPaymentComplete={handlePaymentComplete}
                onCancel={handleCancel}
                submitLabel={submitLabel}
              />
            </Elements>
          )}

          {!stripePromise && !error && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600">Loading payment form...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
