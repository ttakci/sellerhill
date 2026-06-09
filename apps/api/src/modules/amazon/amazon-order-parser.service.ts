import { Injectable, Logger } from '@nestjs/common';
import type { AmazonScrapedOrderData } from '@repo/shared';
import type { Page } from 'playwright';

@Injectable()
export class AmazonOrderParserService {
  private readonly logger = new Logger(AmazonOrderParserService.name);

  async parseOrderPage(page: Page, amazonOrderId: string): Promise<AmazonScrapedOrderData> {
    // Extract order status
    const statusText = await this.extractStatus(page);

    // Extract line items
    const items = await this.extractItems(page);

    // Extract financial summary
    const financials = await this.extractFinancials(page);

    // Extract tracking info
    const tracking = await this.extractTracking(page);

    return {
      amazonOrderId,
      orderDate: await this.extractOrderDate(page),
      status: statusText,
      items,
      subtotal: financials.subtotal,
      shipping: financials.shipping,
      tax: financials.tax,
      grandTotal: financials.grandTotal,
      trackingNumber: tracking.trackingNumber,
      trackingCarrier: tracking.trackingCarrier,
      trackingUrl: tracking.trackingUrl,
    };
  }

  async parseOrderStatus(
    page: Page
  ): Promise<{ status: string; trackingNumber?: string; trackingCarrier?: string }> {
    const status = await this.extractStatus(page);
    const tracking = await this.extractTracking(page);
    return { status, ...tracking };
  }

  private async extractStatus(page: Page): Promise<string> {
    // Amazon order status is typically in a delivery status bar
    const statusSelectors = [
      '[data-component="deliveryStatus"] .a-text-bold',
      '.delivery-status-card-title',
      '#orderDetails .a-row .a-text-bold',
    ];

    for (const selector of statusSelectors) {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await el.textContent();
        if (text) {
          return this.normalizeStatus(text.trim());
        }
      }
    }

    return 'pending';
  }

  private async extractOrderDate(page: Page): Promise<string | undefined> {
    const dateEl = page.locator('[data-component="orderDate"], .order-date-invoice-item').first();
    if (await dateEl.isVisible({ timeout: 2000 }).catch(() => false)) {
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
        const title = await titleEl.isVisible({ timeout: 1000 }).catch(() => false)
          ? (await titleEl.textContent())?.trim()
          : undefined;

        if (!title) {continue;}

        const priceText = await itemEl.locator('.a-color-price').first().textContent().catch(() => '');
        const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0 : 0;

        // Try to extract ASIN from the link
        const href = await titleEl.getAttribute('href').catch(() => '');
        const asinMatch = href?.match(/\/dp\/([A-Z0-9]{10})/i);
        const asin = asinMatch?.[1];

        const qtyText = await itemEl.locator('.item-view-qty, .quantity').first().textContent().catch(() => '1');
        const quantity = parseInt(qtyText?.replace(/[^0-9]/g, '') || '1', 10);

        items.push({ title, price, quantity, asin });
      } catch {
        continue;
      }
    }

    return items;
  }

  private async extractFinancials(page: Page): Promise<{
    subtotal: number;
    shipping: number;
    tax: number;
    grandTotal: number;
  }> {
    const defaultFinancials = { subtotal: 0, shipping: 0, tax: 0, grandTotal: 0 };

    // Financial summary is in an order-summary or payment-breakdown section
    const summarySection = page.locator('#orderSummary, .payment-breakdown, [data-component="orderSummary"]').first();

    if (!(await summarySection.isVisible({ timeout: 3000 }).catch(() => false))) {
      this.logger.warn('Could not find order summary section');
      return defaultFinancials;
    }

    const text = await summarySection.textContent().catch(() => '');
    if (!text) {return defaultFinancials;}

    return {
      subtotal: this.extractAmount(text, /subtotal[:\s]*\$?([\d,]+\.?\d*)/i),
      shipping: this.extractAmount(text, /shipping[:\s]*\$?([\d,]+\.?\d*)/i),
      tax: this.extractAmount(text, /tax[:\s]*\$?([\d,]+\.?\d*)/i) ||
        this.extractAmount(text, /estimated tax[:\s]*\$?([\d,]+\.?\d*)/i),
      grandTotal: this.extractAmount(text, /grand total[:\s]*\$?([\d,]+\.?\d*)/i) ||
        this.extractAmount(text, /total[:\s]*\$?([\d,]+\.?\d*)/i),
    };
  }

  private async extractTracking(page: Page): Promise<{
    trackingNumber?: string;
    trackingCarrier?: string;
    trackingUrl?: string;
  }> {
    const result: { trackingNumber?: string; trackingCarrier?: string; trackingUrl?: string } = {};

    // Look for tracking link/button
    const trackBtn = page.locator('a:has-text("Track package"), a:has-text("Track Package"), a:has-text("Track shipment")').first();

    if (await trackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      result.trackingUrl = await trackBtn.getAttribute('href') || undefined;

      // Try to extract tracking number from the page
      const pageText = await page.textContent('body').catch(() => '');
      if (pageText) {
        // Common tracking number patterns
        const trackingPatterns = [
          /tracking[^:]*[:\s]+([A-Z0-9]{10,30})/i,
          /TBA\d{13,}/, // Amazon Logistics
          /1Z[A-Z0-9]{16}/, // UPS
          /9[4-7]\d{20,}/, // USPS
          /\d{12,14}/, // FedEx
        ];

        for (const pattern of trackingPatterns) {
          const match = pageText.match(pattern);
          if (match) {
            result.trackingNumber = match[0].trim() || match[1]?.trim();
            break;
          }
        }
      }

      // Try to determine carrier from URL or text
      const text = await page.textContent('body').catch(() => '');
      if (text) {
        if (/usps/i.test(text)) {result.trackingCarrier = 'USPS';}
        else if (/ups/i.test(text)) {result.trackingCarrier = 'UPS';}
        else if (/fedex/i.test(text)) {result.trackingCarrier = 'FedEx';}
        else if (/dhl/i.test(text)) {result.trackingCarrier = 'DHL';}
        else if (/amazon\s*logistics/i.test(text)) {result.trackingCarrier = 'Amazon Logistics';}
      }
    }

    return result;
  }

  private extractAmount(text: string, pattern: RegExp): number {
    const match = text.match(pattern);
    if (!match?.[1]) {return 0;}
    return parseFloat(match[1].replace(/,/g, '')) || 0;
  }

  private normalizeStatus(status: string): string {
    const lower = status.toLowerCase();
    if (lower.includes('deliver') && lower.includes('not yet')) {return 'pending';}
    if (lower.includes('shipped') || lower.includes('on the way')) {return 'shipped';}
    if (lower.includes('delivered') || lower.includes('arrived')) {return 'delivered';}
    if (lower.includes('cancel')) {return 'cancelled';}
    if (lower.includes('return')) {return 'returned';}
    if (lower.includes('processing') || lower.includes('preparing')) {return 'processing';}
    return lower;
  }
}
