'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SubscriptionPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPaymentComplete: (paymentIntentId: string) => void;
  onCancel: () => void;
}

function PaymentForm({
  onPaymentComplete,
  onCancel
}: {
  onPaymentComplete: (paymentIntentId: string) => void;
  onCancel: () => void;
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
      const paymentElement = elements.getElement('payment');
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
    } catch (err: any) {
      console.error('Error processing payment:', err);
      setError(err.message || 'Payment processing failed');
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
          {processing ? 'Processing...' : 'Subscribe $5.00/month'}
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
}: SubscriptionPaymentDialogProps) {
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    initStripe();
  }, []);

  // Create payment intent when dialog opens
  useEffect(() => {
    if (open && stripePromise) {
      createPaymentIntent();
    }
  }, [open, stripePromise]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      setError(null);

      const { apiClient } = await import('@/lib/api');
      const paymentData = await apiClient.createPremiumSubscriptionPaymentIntent();

      setClientSecret(paymentData.clientSecret);
      setPaymentIntentId(paymentData.paymentIntentId);
    } catch (err: any) {
      console.error('Error creating payment intent:', err);
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

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
            You've reached the limit of 500 indexed items on the free tier.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Choose an option:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Delete some items to stay within the free tier (500 items)</li>
              <li>Subscribe to Premium ($5/month) for unlimited items</li>
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Plan:</span>
              <span className="font-medium">Premium Subscription</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Price:</span>
              <span className="font-bold text-lg">$5.00/month</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <strong>Benefits:</strong>
              </p>
              <ul className="text-sm text-gray-600 mt-1 list-disc list-inside">
                <li>Unlimited indexed items</li>
                <li>No item creation limits</li>
              </ul>
            </div>
          </div>

          {typeof window !== 'undefined' && window.location.protocol === 'http:' && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded text-sm">
              <strong>Note:</strong> In development mode, you'll need to manually enter card details.
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
