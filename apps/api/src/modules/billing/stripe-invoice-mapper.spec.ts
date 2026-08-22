import { mapStripeInvoice } from './stripe-invoice-mapper';

describe('mapStripeInvoice', () => {
  const base = {
    id: 'in_1',
    created: 1_755_000_000,
    currency: 'try',
    amount_paid: 124_843,
    amount_due: 124_843,
    status: 'paid',
    hosted_invoice_url: 'https://pay.stripe.com/x',
    invoice_pdf: 'https://pay.stripe.com/x.pdf',
    lines: { data: [{ description: 'Nano plan' }] },
  };

  it('reports the currency actually charged, not an assumed USD', () => {
    // Adaptive Pricing bills a Turkish seller in TRY; assuming USD would
    // misreport what left their account.
    expect(mapStripeInvoice(base).currency).toBe('TRY');
  });

  it('converts minor units to micro-units', () => {
    expect(mapStripeInvoice(base).amountMicros).toBe(1_248_430_000);
  });

  it('takes the description from the first line item', () => {
    expect(mapStripeInvoice(base).description).toBe('Nano plan');
  });

  it('reports amount_due for an unpaid invoice, not amount_paid', () => {
    // An open invoice has amount_paid 0; showing that would tell a suspended
    // seller they owe nothing.
    const open = { ...base, status: 'open', amount_paid: 0, amount_due: 2_999 };
    expect(mapStripeInvoice(open).amountMicros).toBe(29_990_000);
  });

  it('carries a null description rather than inventing one', () => {
    expect(mapStripeInvoice({ ...base, lines: { data: [] } }).description).toBeNull();
  });
});
