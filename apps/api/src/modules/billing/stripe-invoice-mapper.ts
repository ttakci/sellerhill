// apps/api/src/modules/billing/stripe-invoice-mapper.ts
import type { BillingInvoiceDto } from '@repo/shared';

/** Minimal shape we read off a Stripe invoice. Structural rather than the SDK
 *  type so this stays a pure function the Jest harness can cover. */
export interface StripeInvoiceLike {
  id: string;
  created: number;
  currency: string;
  amount_paid: number;
  amount_due: number;
  status: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  lines?: { data: Array<{ description?: string | null }> };
}

/**
 * Stripe invoice → the DTO the billing page renders.
 *
 * Two rules matter here. The currency is whatever Stripe charged — Adaptive
 * Pricing bills a Turkish seller in TRY, and defaulting to USD would misreport
 * what left their account. And an unpaid invoice reports `amount_due`, not
 * `amount_paid`: the latter is 0 on an open invoice, which would tell a
 * suspended seller they owe nothing.
 */
export function mapStripeInvoice(raw: StripeInvoiceLike): BillingInvoiceDto {
  const minorUnits = raw.status === 'paid' ? raw.amount_paid : raw.amount_due;
  return {
    id: raw.id,
    issuedAt: new Date(raw.created * 1000).toISOString(),
    description: raw.lines?.data[0]?.description ?? null,
    // Stripe amounts are minor units (cents); our DTOs are micro-units.
    amountMicros: minorUnits * 10_000,
    currency: raw.currency.toUpperCase(),
    status: raw.status ?? 'unknown',
    hostedUrl: raw.hosted_invoice_url ?? null,
    pdfUrl: raw.invoice_pdf ?? null,
  };
}
