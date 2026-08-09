/**
 * The application's daily eBay quota for a resource is spent.
 *
 * This is NOT a failure of the work — the listing, price push or category
 * lookup is perfectly valid, there is simply no allowance left today. eBay
 * meters per application, so one busy day exhausts the quota for every seller
 * on the platform at once.
 *
 * Queue consumers must catch this and re-schedule for `resetAt` rather than
 * marking the item failed: "deferred until tomorrow" and "eBay rejected this"
 * are completely different things to tell a user.
 *
 * It lives beside the budget service rather than in `ebay.errors.ts` so the
 * budget module stays free of any dependency on the eBay feature module — that
 * independence is what lets both EbayModule and AdminModule consume it without
 * closing the Ebay -> Llm -> Admin import cycle.
 */
export class EbayBudgetExhaustedError extends Error {
  readonly code = 'budget_exhausted';

  constructor(
    readonly resource: string,
    readonly resetAt: Date
  ) {
    super(`The daily eBay ${resource} call budget is exhausted; it resets at ${resetAt.toISOString()}.`);
    this.name = 'EbayBudgetExhaustedError';
  }
}
