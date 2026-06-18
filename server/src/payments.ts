import type { InvoiceDTO } from '@ocpp/shared';
import { config } from './config';
import { log } from './logger';
import { store } from './store';

export interface CheckoutResult {
  invoice: InvoiceDTO;
  provider: 'mock' | 'stripe';
  /** Stripe client secret, when a real PaymentIntent was created. */
  clientSecret?: string;
  status: string;
}

/**
 * Payment gateway. Uses Stripe when STRIPE_SECRET_KEY is configured; otherwise a
 * mock gateway settles instantly so the billing flow is fully exercisable in
 * development without external keys.
 */
export async function checkout(invoiceId: string): Promise<CheckoutResult> {
  const invoice = store.getInvoice(invoiceId);
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'paid')
    return { invoice, provider: 'mock', status: 'already_paid' };

  if (config.stripeSecretKey) {
    const clientSecret = await createStripePaymentIntent(invoice);
    // Real settlement is confirmed by the client + Stripe webhook; here we only
    // create the intent and hand back the client secret.
    return { invoice, provider: 'stripe', clientSecret, status: 'requires_payment' };
  }

  const paid = store.markInvoicePaid(invoice.id, 'card (mock)');
  log.info(`Mock payment settled for ${invoice.number} (${invoice.amount} ${invoice.currency})`);
  return { invoice: paid ?? invoice, provider: 'mock', status: 'paid' };
}

async function createStripePaymentIntent(invoice: InvoiceDTO): Promise<string> {
  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      amount: String(Math.round(invoice.amount * 100)),
      currency: invoice.currency.toLowerCase(),
      'metadata[invoice]': invoice.number,
      'metadata[transactionId]': invoice.transactionId,
    }),
  });
  if (!res.ok) throw new Error(`Stripe error: ${await res.text()}`);
  const intent = (await res.json()) as { client_secret: string };
  return intent.client_secret;
}
