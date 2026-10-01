import { Injectable, Logger } from '@nestjs/common';
import { type AmazonFinancials, type AmazonScrapedOrderData } from '@repo/shared';
import type { Page } from 'playwright';

/**
 * A real UPS number is `1Z` + 6-char shipper id + 2-digit service code +
 * 8 digits. The old `1Z[A-Z0-9]{16}` accepted `1ZAUXFMSEBKUFEFJRA` — a string
 * with no digits after the prefix, lifted out of <script> text on the first
 * live order — and labelled it UPS, which would have pushed it to eBay raw.
 */
const UPS_TRACKING_RE = /^1Z[0-9A-Z]{6}\d{2}\d{8}$/;

/**
 * Tracking number found in the VISIBLE text of an Amazon page, or undefined.
 *
 * Every pattern is anchored to a word boundary and every candidate must be a
 * carrier-shaped code (uppercase, several digits): a bare `\d{12,14}` or
 * `[A-Z0-9]{10,30}` scan over a whole page also matches order ids, phone
 * numbers and script blobs. Returning nothing is always safer than a guess —
 * the tracking processor re-reads on every tick, and a wrong number would go
 * to the buyer through eBay's write-once fulfillment call.
 */
export function extractTrackingNumberFromText(text: string): string | undefined {
  if (!text) {
    return undefined;
  }
  const labelled = text.match(/tracking\s*(?:id|number|#)?\s*[:#]\s*([A-Z0-9]{10,34})\b/i)?.[1];
  const candidates = [
    labelled,
    text.match(/\bTBA\d{12,}\b/)?.[0],
    text.match(/\b1Z[0-9A-Z]{6}\d{10}\b/)?.[0],
    text.match(/\b9[2-5]\d{18,24}\b/)?.[0],
  ];
  for (const candidate of candidates) {
    if (candidate && isPlausibleTrackingNumber(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function isPlausibleTrackingNumber(value: string): boolean {
  if (value !== value.toUpperCase()) {
    return false;
  }
  const digits = (value.match(/\d/g) ?? []).length;
  return digits >= 4 && /^[A-Z0-9]+$/.test(value);
}

/**
 * Amazon's delivery-status wording → our coarse status vocabulary.
 *
 * Unrecognised text is `pending`, never echoed back: the first live order was
 * stamped with the status "grand total:" because a fallback selector matched
 * the order-summary label. An ETA line ("Arriving tomorrow") on its own says
 * nothing about shipment — Amazon prints it before AND after the parcel ships
 * — so a selector that yields one resolves to `pending` and leaves the real
 * status to the progress tracker (`parseTrackerStatus`).
 */
export function normalizeAmazonStatus(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes('cancel')) {
    return 'cancelled';
  }
  if (lower.includes('return') || lower.includes('refund')) {
    return 'returned';
  }
  if (lower.includes('delivered') || lower.includes('arrived')) {
    return 'delivered';
  }
  if (lower.includes('not yet shipped') || lower.includes('not shipped yet')) {
    return 'pending';
  }
  if (
    lower.includes('shipped') ||
    lower.includes('on the way') ||
    lower.includes('out for delivery') ||
    lower.includes('in transit')
  ) {
    return 'shipped';
  }
  if (lower.includes('processing') || lower.includes('preparing')) {
    return 'processing';
  }
  return 'pending';
}

/**
 * Delivery status read from a page's VISIBLE text, line by line, or undefined.
 *
 * Amazon's delivery heading ("Arriving tomorrow", "Shipped", "Out for
 * delivery", "Delivered September 30") is a short line of its own at the top
 * of both the order-details and the progress-tracker page. The DOM selectors
 * around it change often — on the first live order none of them matched — so
 * this is the fallback that does not depend on class names.
 *
 * Every pattern is anchored to the START of a short line. That is what keeps
 * the page's buttons out: "Cancel items" and "Return or replace items" are
 * both on every order page, and a substring match would cancel or return the
 * order in our books on every tick.
 *
 * Two rules come from the real progress-tracker layout (order
 * 03-15243-67997, 2026-09-30, saved pages in the spec):
 * - The ETA heading ("Arriving tomorrow", "Now expected …") is printed FIRST
 *   and stays there after the parcel ships, so it is a DATE line, not a
 *   status: it is remembered and the scan goes on. Three ticks once read it
 *   as the status and never reached the "Shipped" heading under it.
 * - The four milestone labels "Ordered · Shipped · Out for delivery ·
 *   Delivered" are printed on EVERY tracker page, reached or not, right after
 *   the status card. The first exact "Ordered" line ends the scan: whatever
 *   the status card said has been read by then, and a label must never be
 *   read as a status (a false "shipped" is an irreversible eBay push).
 */
export function detectAmazonStatusLine(text: string): string | undefined {
  if (!text) {
    return undefined;
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length <= 48);
  let etaSeen = false;
  for (const line of lines) {
    if (/^ordered$/i.test(line)) {
      return 'pending';
    }
    if (/^cancell?ed\b/i.test(line)) {
      return 'cancelled';
    }
    if (/^(returned|return (started|received|complete)|refund (issued|complete))\b/i.test(line)) {
      return 'returned';
    }
    if (/^delivered\b/i.test(line)) {
      return 'delivered';
    }
    if (/^(shipped|out for delivery|on the way|in transit)\b/i.test(line)) {
      return 'shipped';
    }
    if (/^(preparing for (shipment|dispatch))\b/i.test(line)) {
      return 'processing';
    }
    if (/^(not yet shipped|not shipped yet)\b/i.test(line)) {
      return 'pending';
    }
    if (/^(arriving|now expected)\b/i.test(line)) {
      etaSeen = true;
    }
  }
  return etaSeen ? 'pending' : undefined;
}

/**
 * Carrier for a tracking number.
 *
 * The number is checked FIRST because it is unambiguous, and Amazon Logistics
 * is checked before every other carrier. The previous implementation scanned
 * the page body with bare substrings (`/ups/i` matches "groups", "backups")
 * and tested Amazon Logistics last, so a TB* shipment on a page mentioning any
 * such word was labelled UPS. That is the worst possible direction: the
 * default conversion scope is amazon_logistics_only, so the shipment most in
 * need of hiding the supplier was the one skipped.
 */
export function resolveTrackingCarrier(trackingNumber: string | undefined, pageText: string): string | undefined {
  const num = (trackingNumber || '').trim().toUpperCase();
  if (/^TB[A-Z]/.test(num)) {
    return 'Amazon Logistics';
  }
  if (UPS_TRACKING_RE.test(num)) {
    return 'UPS';
  }
  if (/^9[2-5]\d{18,24}$/.test(num)) {
    return 'USPS';
  }

  // Word-bounded so a carrier name inside another word cannot match.
  if (/amazon\s*logistics/i.test(pageText)) {
    return 'Amazon Logistics';
  }
  if (/\bUSPS\b|\bUnited States Postal\b/i.test(pageText)) {
    return 'USPS';
  }
  if (/\bUPS\b/.test(pageText)) {
    return 'UPS';
  }
  if (/\bFedEx\b/i.test(pageText)) {
    return 'FedEx';
  }
  if (/\bDHL\b/i.test(pageText)) {
    return 'DHL';
  }
  return undefined;
}

/**
 * True when `visibleText` prints `amazonOrderId` ("Order # 113-1234567-1234567").
 * An empty id never matches — `''.includes('')` would call every page a proof.
 */
export function isOrderIdOnPage(visibleText: string, amazonOrderId: string): boolean {
  const id = amazonOrderId.trim();
  return id.length > 0 && visibleText.includes(id);
}

@Injectable()
export class AmazonOrderParserService {
  private readonly logger = new Logger(AmazonOrderParserService.name);

  async parseOrderPage(page: Page, amazonOrderId: string): Promise<AmazonScrapedOrderData> {
    // Extract order status
    const statusText = await this.extractStatus(page);

    // Extract line items
    const items = await this.extractItems(page);

    // Extract financial summary (tagged result — ok:false means DOM miss)
    const financials = await this.extractFinancials(page);

    // Extract tracking info
    const tracking = await this.extractTracking(page);

    // VISIBLE text only (see extractTracking) — the id also sits in URLs and
    // script state of pages that are not this order.
    const visibleText = await page
      .locator('body')
      .innerText()
      .catch(() => '');

    return {
      amazonOrderId,
      orderIdOnPage: isOrderIdOnPage(visibleText, amazonOrderId),
      orderDate: await this.extractOrderDate(page),
      status: statusText,
      items,
      subtotal: financials.ok ? financials.subtotal : 0,
      shipping: financials.ok ? financials.shipping : 0,
      tax: financials.ok ? financials.tax : 0,
      grandTotal: financials.ok ? financials.grandTotal : 0,
      trackingNumber: tracking.trackingNumber,
      trackingCarrier: tracking.trackingCarrier,
      trackingUrl: tracking.trackingUrl,
      costCaptureFailed: !financials.ok,
    };
  }

  async parseOrderStatus(page: Page): Promise<{
    status: string;
    trackingNumber?: string;
    trackingCarrier?: string;
    trackingUrl?: string;
  }> {
    const status = await this.extractStatus(page);
    const tracking = await this.extractTracking(page);
    return { status, ...tracking };
  }

  /**
   * Delivery status from the progress tracker's own status card, or undefined.
   *
   * The tracker page ("Track package") carries the status as
   * `<h1 class="pt-status-main-status">` — "Ordered", "Shipped",
   * "Delivered" — separate from the promise card's ETA heading
   * (`.pt-promise-main-slot`, "Arriving tomorrow"). Verified on two saved
   * pages (2026-09-30): a shipped order reads "Shipped", an unshipped one
   * "Ordered". Undefined when the card is not there, so the caller can fall
   * back to the visible text (`detectAmazonStatusLine`).
   */
  async parseTrackerStatus(page: Page): Promise<string | undefined> {
    const heading = page.locator('.pt-status-main-status').first();
    const visible = await heading
      .waitFor({ state: 'visible', timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (!visible) {
      return undefined;
    }
    const text = (await heading.textContent().catch(() => null))?.trim();
    return text ? normalizeAmazonStatus(text) : undefined;
  }

  private async extractStatus(page: Page): Promise<string> {
    // Amazon order status is typically in a delivery status bar. The old
    // `#orderDetails .a-row .a-text-bold` fallback is gone: it matched the
    // "Grand Total:" label of the order summary.
    const statusSelectors = [
      '[data-component="deliveryStatus"] .a-text-bold',
      '.delivery-status-card-title',
      '.delivery-box__primary-text',
      '[data-component="orderDeliveryStatus"]',
      '.od-status-message',
    ];

    for (const selector of statusSelectors) {
      const el = page.locator(selector).first();
      if (
        await el
          .first()
          .waitFor({ state: 'visible', timeout: 2000 })
          .then(() => true)
          .catch(() => false)
      ) {
        const text = await el.textContent();
        if (text?.trim()) {
          return normalizeAmazonStatus(text.trim());
        }
      }
    }

    // No selector matched — read the delivery heading off the visible text.
    const visible = await page
      .locator('body')
      .innerText()
      .catch(() => '');
    return detectAmazonStatusLine(visible) ?? 'pending';
  }

  private async extractOrderDate(page: Page): Promise<string | undefined> {
    const dateEl = page.locator('[data-component="orderDate"], .order-date-invoice-item').first();
    if (
      await dateEl
        .first()
        .waitFor({ state: 'visible', timeout: 2000 })
        .then(() => true)
        .catch(() => false)
    ) {
      const text = await dateEl.textContent();
      return text?.trim() || undefined;
    }
    return undefined;
  }

  private async extractItems(page: Page): Promise<AmazonScrapedOrderData['items']> {
    const items: AmazonScrapedOrderData['items'] = [];

    // Amazon order items are in fixed-layout sections
    const itemElements = page.locator('.fixed-left-grid-inner, [data-component="orderDetailsRow"]');

    const count = await itemElements.count();

    for (let i = 0; i < count; i++) {
      const itemEl = itemElements.nth(i);

      try {
        const titleEl = itemEl.locator('a.a-link-normal').first();
        const title = (await titleEl
          .first()
          .waitFor({ state: 'visible', timeout: 1000 })
          .then(() => true)
          .catch(() => false))
          ? (await titleEl.textContent())?.trim()
          : undefined;

        if (!title) {
          continue;
        }

        const priceText = await itemEl
          .locator('.a-color-price')
          .first()
          .textContent()
          .catch(() => '');
        const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0 : 0;

        // Try to extract ASIN from the link
        const href = await titleEl.getAttribute('href').catch(() => '');
        const asinMatch = href?.match(/\/dp\/([A-Z0-9]{10})/i);
        const asin = asinMatch?.[1];

        const qtyText = await itemEl
          .locator('.item-view-qty, .quantity')
          .first()
          .textContent()
          .catch(() => '1');
        const quantity = parseInt(qtyText?.replace(/[^0-9]/g, '') || '1', 10);

        items.push({ title, price, quantity, asin });
      } catch {
        continue;
      }
    }

    return items;
  }

  /**
   * Extract the order financial summary from the page.
   * Returns `{ ok: false }` when the summary section is missing OR every parsed
   * value is zero/NaN — callers MUST treat this as a scrape failure and never
   * overwrite existing cost fields with zeros (Task 5: scrape integrity).
   * Tracking extraction is separate and unaffected.
   */
  private async extractFinancials(page: Page): Promise<AmazonFinancials> {
    // `#od-subtotals` first: on the live order-details page (captured
    // 2026-10-01, `__fixtures__/checkout/order-details.html`) it holds the five
    // cost lines and nothing else. The wider `[data-component="orderSummary"]`
    // block around it also carries the ship-to address, the payment widget and
    // that widget's inline <style>/<script> text, so it is the fallback only.
    const candidates = ['#od-subtotals', '#orderSummary, .payment-breakdown, [data-component="orderSummary"]'];

    for (const selector of candidates) {
      const section = page.locator(selector).first();
      const visible = await section
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (!visible) {
        continue;
      }
      const text = (await section.textContent().catch(() => '')) ?? '';
      const financials = this.parseFinancialsFromText(text);
      if (financials.ok) {
        return financials;
      }
    }

    this.logger.warn('Could not read the order summary section');
    return { ok: false };
  }

  /**
   * Pure text parser that backs `extractFinancials`. Exposed for unit tests
   * (no Playwright Page dependency). Returns `{ ok: false }` when the text is
   * empty or every parsed amount is 0/NaN — i.e. the DOM did not yield a
   * trustworthy cost breakdown.
   */
  parseFinancialsFromText(text: string): AmazonFinancials {
    if (!text) {
      this.logger.warn('Amazon financials could not be parsed (empty summary text)');
      return { ok: false };
    }

    // Amazon's order-summary lines, as textContent renders them:
    //   Item(s) Subtotal:$13.91  Shipping & Handling:$0.00  Total before tax:$13.91
    //   Estimated tax to be collected:$0.97  Grand Total:$14.88
    // "Total before tax" is removed BEFORE the tax lookup — a bare /tax/ once
    // matched it first and linked the first live order with tax = subtotal.
    const withoutBeforeTax = text.replace(/total before tax[:\s]*\$?[\d,]+\.?\d*/gi, '');

    const subtotal = this.extractAmount(text, /subtotal[:\s]*\$?([\d,]+\.?\d*)/i);
    const shipping = this.extractAmount(text, /shipping(?:\s*(?:&|and)\s*handling)?[:\s]*\$?([\d,]+\.?\d*)/i);
    const tax =
      this.extractAmount(withoutBeforeTax, /estimated tax(?:\s+to\s+be\s+collected)?[:\s]*\$?([\d,]+\.?\d*)/i) ||
      this.extractAmount(withoutBeforeTax, /\btax[:\s]*\$?([\d,]+\.?\d*)/i);
    // `\btotal` so "Subtotal:$13.91" cannot feed the grand total.
    const grandTotal =
      this.extractAmount(text, /grand total[:\s]*\$?([\d,]+\.?\d*)/i) ||
      this.extractAmount(withoutBeforeTax, /\btotal[:\s]*\$?([\d,]+\.?\d*)/i);

    const allZero = !subtotal && !shipping && !tax && !grandTotal;
    if (allZero) {
      this.logger.warn('Amazon financials could not be parsed (all values zero/NaN)');
      return { ok: false };
    }

    return { ok: true, subtotal, shipping, tax, grandTotal };
  }

  private async extractTracking(page: Page): Promise<{
    trackingNumber?: string;
    trackingCarrier?: string;
    trackingUrl?: string;
  }> {
    const result: { trackingNumber?: string; trackingCarrier?: string; trackingUrl?: string } = {};

    // Look for tracking link/button
    const trackBtn = page
      .locator('a:has-text("Track package"), a:has-text("Track Package"), a:has-text("Track shipment")')
      .first();

    if (
      await trackBtn
        .first()
        .waitFor({ state: 'visible', timeout: 2000 })
        .then(() => true)
        .catch(() => false)
    ) {
      result.trackingUrl = (await trackBtn.getAttribute('href')) || undefined;

      // VISIBLE text only. `textContent('body')` includes every <script>
      // body, and a base64-ish blob in one of them is where the first live
      // order's "1ZAUXFMSEBKUFEFJRA" came from.
      const pageText = await page
        .locator('body')
        .innerText()
        .catch(() => '');
      result.trackingNumber = extractTrackingNumberFromText(pageText);

      // Determine carrier from the tracking number first, page text second.
      result.trackingCarrier = resolveTrackingCarrier(result.trackingNumber, pageText);
    }

    return result;
  }

  private extractAmount(text: string, pattern: RegExp): number {
    const match = text.match(pattern);
    if (!match?.[1]) {
      return 0;
    }
    return parseFloat(match[1].replace(/,/g, '')) || 0;
  }
}
