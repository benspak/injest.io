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

interface ImportPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  type: 'bookmark';
  onPaymentComplete: (paymentIntentId: string) => void;
  onCancel: () => void;
}

function PaymentForm({
  count,
  type,
  onPaymentComplete,
  onCancel
}: {
  count: number;
  type: 'bookmark';
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

  const itemName = 'bookmark';
  const itemNamePlural = 'bookmarks';

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
          {processing ? 'Processing...' : `Pay $5.00`}
        </Button>
      </div>
    </form>
  );
}

export function ImportPaymentDialog({
  open,
  onOpenChange,
  count,
  type,
  onPaymentComplete,
  onCancel,
}: ImportPaymentDialogProps) {
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemName = 'bookmark';
  const itemNamePlural = 'bookmarks';

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
    if (open && count > 0 && stripePromise) {
      createPaymentIntent();
    }
  }, [open, count, stripePromise]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      setError(null);

      const { apiClient } = await import('@/lib/api');
      const paymentData = await apiClient.createBookmarkImportPaymentIntent(count);

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
          <DialogTitle>Payment Required</DialogTitle>
          <DialogDescription>
            Import {count} {count !== 1 ? itemNamePlural : itemName} for $5
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
            <strong>Note:</strong> This $5 fee covers OpenAI token usage for metadata enrichment and processing.
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600 capitalize">{itemNamePlural}:</span>
              <span className="font-medium">{count}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Amount:</span>
              <span className="font-bold text-lg">$5.00</span>
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
                count={count}
                type={type}
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
