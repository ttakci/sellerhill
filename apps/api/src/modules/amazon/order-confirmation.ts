/**
 * Pure readers for the two pages around the Place Order click — no Playwright
 * dependency, so each rule is unit-tested against the captured markup.
 *
 * Why these exist (2026-10-01): Amazon's thank-you page
 * (`/gp/buy/thankyou/handlers/display.html?purchaseId=…`, captured from a hand
 * purchase of order 17-15222-04697) says "Order placed, thanks!" and carries NO
 * Amazon order id and NO cost summary. The old confirmation parse looked for an
 * order-id element and a summary block, found neither, and would have ended a
 * REAL placement as `no_confirmation` — money spent, order blocked, nothing
 * linked. The proof of placement is now the page itself; the costs come from the
 * review page read just before the click; the id is looked up in "Your Orders".
 */

/** Costs as Amazon's review page itemises them. */
export interface ReviewCostLines {
  items: number;
  shipping: number;
  tax: number;
}

const AMOUNT = String.raw`\$\s*([\d,]+\.\d{2})`;
const ORDER_ID = /\b(\d{3}-\d{7}-\d{7})\b/;

function amount(text: string, label: string): number | null {
  const m = text.match(new RegExp(`${label}\\s*:?\\s*${AMOUNT}`, 'i'));
  if (!m?.[1]) {
    return null;
  }
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Split the review page's order summary (`#subtotals-marketplace-table`:
 * "Items: $8.79 · Shipping & handling: $0.00 · Estimated tax to be collected:
 * $0.62 · Order total: $9.41") into cost fields. When the items line is
 * missing, items = total − shipping − tax, so the three always reconcile to the
 * total the spend cap was checked against.
 */
export function parseReviewCostLines(summaryText: string, grandTotal: number): ReviewCostLines {
  const shipping = amount(summaryText, String.raw`shipping\s*(?:&|and)\s*handling`) ?? 0;
  const tax = amount(summaryText, String.raw`estimated\s+tax(?:\s+to\s+be\s+collected)?`) ?? 0;
  const items =
    amount(summaryText, String.raw`items(?:\s*\(\d+\))?`) ?? Math.max(0, Number((grandTotal - shipping - tax).toFixed(2)));
  return { items, shipping, tax };
}

/**
 * Did the click place an order? Either Amazon's thank-you route or its
 * "Order placed" heading. The route is only ever reached after a purchase; the
 * heading covers a layout that keeps the checkout URL.
 */
export function isOrderPlacedPage(url: string, headingText: string | null): boolean {
  if (/\/gp\/buy\/thankyou\//i.test(url)) {
    return true;
  }
  return /\border placed\b/i.test(headingText ?? '');
}

/**
 * Find the order id for the item just bought among the newest "Your Orders"
 * cards (outer HTML, newest first).
 *
 * Deliberately narrow, because a wrong id attaches another purchase's costs and
 * tracking to this sale: only the first `maxCards` cards, only a card that
 * links our ASIN, only an id no other order already carries. No match → null,
 * and the order stays PLACED-without-id for cost-capture to link.
 *
 * The card markup is NOT verified against a live "Your Orders" page yet (the
 * list selectors in `amazon-scraping.service.ts` carry the same caveat); the
 * `order-history` evidence snap exists to settle that.
 */
export function pickOrderIdFromHistoryCards(
  cardsHtml: readonly string[],
  asin: string,
  takenIds: ReadonlySet<string>,
  maxCards = 5
): string | null {
  const asinLink = new RegExp(`/(?:dp|gp/product)/${asin}(?![A-Z0-9])`, 'i');
  for (const html of cardsHtml.slice(0, maxCards)) {
    if (!asinLink.test(html)) {
      continue;
    }
    const fromHref = html.match(/orderI[dD]=(\d{3}-\d{7}-\d{7})/);
    const id = fromHref?.[1] ?? html.match(ORDER_ID)?.[1] ?? null;
    if (id && !takenIds.has(id)) {
      return id;
    }
  }
  return null;
}
