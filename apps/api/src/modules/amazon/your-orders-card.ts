/**
 * Pure readers for one card of Amazon's "Your Orders" list
 * (`/your-orders/orders`), checked against a live capture on 2026-10-01
 * (`__fixtures__/checkout/your-orders.html`).
 *
 * The live card is `div.order-card.js-order-card`. Its header is a plain list
 * of label/value pairs — "Order placed · September 30, 2026", "Total · $9.47",
 * "Ship to · …", "Order # 113-…" — with NO `data-testid` / `.order-date` /
 * `.order-total` hooks, which is what the cost-capture scraper used to look for
 * (so every row came back dated "now" with a $0 total and never matched).
 * Reading by LABEL survives class-name churn better than any class selector.
 */

export interface OrderCardHeader {
  orderDate: Date | null;
  grandTotal: number | null;
}

/**
 * Read the placed date and the total from the text of a card's
 * `.order-header`. A missing or unparseable field is null — never "now",
 * never 0 — so the caller cannot mistake an unread value for a real one.
 */
export function parseOrderCardHeader(text: string): OrderCardHeader {
  const flat = text.replace(/\s+/g, ' ');
  const dateMatch = flat.match(/order placed\s*:?\s*([A-Za-z]+\.?\s+\d{1,2},\s*\d{4})/i);
  const parsedDate = dateMatch?.[1] ? new Date(dateMatch[1].replace('.', '')) : null;
  const totalMatch = flat.match(/\btotal\s*:?\s*\$\s*([\d,]+\.\d{2})/i);
  const total = totalMatch?.[1] ? parseFloat(totalMatch[1].replace(/,/g, '')) : NaN;
  return {
    orderDate: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null,
    grandTotal: Number.isFinite(total) ? total : null,
  };
}

export interface OrderCardRecipient {
  name: string | null;
  zip: string | null;
}

/**
 * Read the "Ship to" recipient of a card: `nameText` is the popover trigger
 * (`.yohtmlc-recipient .a-popover-trigger`, the name Amazon prints under
 * "Ship to"), `blockText` the whole recipient block, whose hidden popover holds
 * the address ("4820 JUNIPER CT FAIRVIEW, OR 97024-1111 United States").
 *
 * The postcode is only accepted right after a two-letter state, so a five-digit
 * house number ("12345 MAIN ST") can never pass for it. Anything unreadable is
 * null — the matcher then refuses to link rather than guess.
 */
export function parseOrderCardRecipient(nameText: string, blockText: string): OrderCardRecipient {
  const name = nameText.replace(/\s+/g, ' ').trim();
  // No trailing \b: textContent joins sibling rows without a space, so the
  // postcode can run straight into "United States" ("72764United States").
  const zips = [...blockText.replace(/\s+/g, ' ').matchAll(/\b[A-Z]{2}\s+(\d{5})(?:-\d{4})?(?!\d)/g)];
  const zip = zips.length > 0 ? zips[zips.length - 1][1] : null;
  return { name: name.length > 0 ? name : null, zip };
}

/**
 * Drop every `<script>` block from a card's outer HTML. The live first card
 * embeds Amazon's ~100 KB client-side decryption library and each card a
 * ship-to `<script type="text/template">`; nothing in a script is page content,
 * so no id or ASIN may be read from one.
 */
export function stripScriptBlocks(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
}
