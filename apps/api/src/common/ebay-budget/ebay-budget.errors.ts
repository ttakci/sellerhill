/**
 * The application's eBay quota for a resource is spent, for ONE of the
 * windows eBay reports on it — not only the daily one. eBay commonly names
 * both a daily ceiling AND a shorter one (e.g. per-minute) for the same
 * resource, and either can be the one that ran out first.
 *
 * This is NOT a failure of the work — the listing, price push or category
 * lookup is perfectly valid, there is simply no allowance left in that
 * window. eBay meters per application, so one busy stretch exhausts the
 * quota for every seller on the platform at once.
 *
 * Queue consumers must catch this and re-schedule for `resetAt` rather than
 * marking the item failed: "deferred until the window resets" and "eBay
 * rejected this" are completely different things to tell a user.
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
    readonly resetAt: Date,
    /** Length of the window that ran out; 86,400 for the daily quota. */
    readonly windowSeconds = 86_400
  ) {
    super(
      `The eBay ${resource} call budget (${windowSeconds}s window) is exhausted; it resets at ${resetAt.toISOString()}.`
    );
    this.name = 'EbayBudgetExhaustedError';
  }
}
