import { AmazonMarketplace } from '@repo/shared';

import type { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonOrderParserService, resolveTrackingCarrier } from './amazon-order-parser.service';
import type { AmazonRateLimiter } from './amazon-rate-limiter.service';
import {
  AmazonScrapingService,
  isTrustedAmazonTrackingUrl,
  resolveTrustedAmazonTrackingUrl,
} from './amazon-scraping.service';
import type { BrowserStateManager } from './browser-state-manager.service';

describe('AmazonOrderParserService.parseFinancialsFromText', () => {
  let service: AmazonOrderParserService;

  beforeEach(() => {
    service = new AmazonOrderParserService();
  });

  it('returns ok:false for empty text (DOM miss / changed layout)', () => {
    expect(service.parseFinancialsFromText('')).toEqual({ ok: false });
  });

  it('returns ok:false when every parsed amount is 0/missing', () => {
    const html = '<div><span>Subtotal:</span><span>$0.00</span></div>';
    expect(service.parseFinancialsFromText(html)).toEqual({ ok: false });
  });

  it('returns ok:true with parsed values when a real summary is present', () => {
    const html = `
      Subtotal: $59.99
      Shipping: $0.00
      Tax: $4.80
      Grand Total: $64.79
    `;
    const result = service.parseFinancialsFromText(html);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subtotal).toBeCloseTo(59.99, 2);
      expect(result.shipping).toBe(0);
      expect(result.tax).toBeCloseTo(4.8, 2);
      expect(result.grandTotal).toBeCloseTo(64.79, 2);
    }
  });

  it('returns ok:true when at least one value is non-zero (free shipping + no tax)', () => {
    // Legitimate $0 Amazon order: free shipping, no tax, but a real subtotal.
    // Must NOT be classified as a scrape failure (Task 5 refinement).
    const html = 'Subtotal $25.00  Shipping $0.00  Tax $0.00  Total $25.00';
    const result = service.parseFinancialsFromText(html);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subtotal).toBeCloseTo(25, 2);
      expect(result.grandTotal).toBeCloseTo(25, 2);
    }
  });
});

describe('resolveTrackingCarrier', () => {
  it('reads the carrier from the tracking number before the page text', () => {
    // The shipped implementation scanned the whole page with /ups/i and tested
    // "amazon logistics" LAST, so any page containing a word like "groups"
    // labelled an Amazon Logistics shipment as UPS — which then silently failed
    // the default amazon_logistics_only conversion scope.
    expect(resolveTrackingCarrier('TBA303940404000', 'Join our groups for updates')).toBe(
      'Amazon Logistics',
    );
  });

  it('still recognises a real UPS number', () => {
    expect(resolveTrackingCarrier('1Z999AA10123456784', '')).toBe('UPS');
  });

  it('falls back to the page text when the number is unrecognised', () => {
    expect(resolveTrackingCarrier('X123', 'Shipped with USPS')).toBe('USPS');
  });

  it('never matches a carrier inside an unrelated word', () => {
    expect(resolveTrackingCarrier('X123', 'backups completed')).toBeUndefined();
  });
});

describe('isTrustedAmazonTrackingUrl', () => {
  const origin = 'https://www.amazon.com';

  it('accepts a same-host relative href resolved against the marketplace origin', () => {
    expect(isTrustedAmazonTrackingUrl('/progress-tracker/package/?orderId=1&packageIndex=0', origin)).toBe(
      true,
    );
  });

  it('accepts a same-host absolute https href', () => {
    expect(isTrustedAmazonTrackingUrl('https://www.amazon.com/gp/css/track', origin)).toBe(true);
  });

  it('refuses a non-Amazon absolute href', () => {
    expect(isTrustedAmazonTrackingUrl('https://evil.example.com/track?pkg=1', origin)).toBe(false);
  });

  it('refuses a non-https scheme even on the trusted host', () => {
    expect(isTrustedAmazonTrackingUrl('http://www.amazon.com/gp/css/track', origin)).toBe(false);
  });

  it('refuses a javascript: URI', () => {
    expect(isTrustedAmazonTrackingUrl('javascript:alert(1)', origin)).toBe(false);
  });

  it('refuses a malformed href without throwing', () => {
    expect(isTrustedAmazonTrackingUrl('http://[::1', origin)).toBe(false);
  });
});

describe('AmazonScrapingService.scrapeOrderStatusWithTrackingHtml — untrusted tracking URL', () => {
  it('refuses a non-Amazon absolute tracking href and still returns the parsed status', async () => {
    const fakePage = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html>evil</html>'),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const accountsService = {
      getDecrypted: jest.fn().mockResolvedValue({
        marketplace: AmazonMarketplace.AMAZON_US,
        email: 'buyer@example.com',
        decryptedPassword: 'pw',
        decryptedTwoFactorSecret: null,
      }),
    } as unknown as AmazonAccountsService;

    const parserService = {
      parseOrderStatus: jest.fn().mockResolvedValue({
        status: 'shipped',
        trackingNumber: 'TBA123',
        trackingCarrier: 'Amazon Logistics',
        // Absolute href to a different host — the untrusted case under test.
        trackingUrl: 'https://evil.example.com/track?pkg=1',
      }),
    } as unknown as AmazonOrderParserService;

    const browserStateManager = {
      isSessionValid: jest.fn().mockResolvedValue(true),
      getContext: jest.fn().mockResolvedValue({ newPage: jest.fn().mockResolvedValue(fakePage) }),
      saveState: jest.fn().mockResolvedValue(undefined),
    } as unknown as BrowserStateManager;

    const rateLimiter = {
      schedule: jest.fn((_accountId: string, fn: () => Promise<unknown>) => fn()),
    } as unknown as AmazonRateLimiter;

    const service = new AmazonScrapingService(
      accountsService,
      parserService,
      browserStateManager,
      rateLimiter,
    );

    const result = await service.scrapeOrderStatusWithTrackingHtml('user-1', 'account-1', 'order-1');

    // Status/tracking-number/carrier from the order-details page always come back.
    expect(result.status).toBe('shipped');
    expect(result.trackingNumber).toBe('TBA123');
    expect(result.trackingCarrier).toBe('Amazon Logistics');
    // The untrusted href is never navigated to, so no HTML is captured.
    expect(result.trackingHtml).toBeUndefined();
    // Only the order-details navigation happened — never a second goto to the evil host.
    expect(fakePage.goto).toHaveBeenCalledTimes(1);
    // And the untrusted href is NOT handed onward either. It would otherwise
    // travel to the provider as `trackingUrl` on a paid conversion.
    expect(result.trackingUrl).toBeUndefined();
  });

  // C1. Amazon renders "Track package" as a SITE-RELATIVE href, and that raw
  // value used to be what the caller got: the absolutized copy existed only as
  // a local for `page.goto`. It then reached Aquiline verbatim as
  // `upsertOrders.trackingUrl` / `assign.trackingUrl`, which rejects it
  // (`tracking_url_mismatch` / `assign_validation`) — so every automatic
  // conversion failed, fail-soft pushed the RAW Amazon number to eBay, and
  // eBay's Fulfillment API has no update endpoint to correct it. Every
  // shipment silently exposed the supplier.
  it('returns the ABSOLUTE tracking URL, not the relative href Amazon rendered', async () => {
    const fakePage = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html>ship-track</html>'),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const accountsService = {
      getDecrypted: jest.fn().mockResolvedValue({
        marketplace: AmazonMarketplace.AMAZON_US,
        email: 'buyer@example.com',
        decryptedPassword: 'pw',
        decryptedTwoFactorSecret: null,
      }),
    } as unknown as AmazonAccountsService;

    const parserService = {
      parseOrderStatus: jest.fn().mockResolvedValue({
        status: 'shipped',
        trackingNumber: 'TBA123',
        trackingCarrier: 'Amazon Logistics',
        trackingUrl: '/progress-tracker/package/?orderId=111-222&packageIndex=0',
      }),
    } as unknown as AmazonOrderParserService;

    const browserStateManager = {
      isSessionValid: jest.fn().mockResolvedValue(true),
      getContext: jest.fn().mockResolvedValue({ newPage: jest.fn().mockResolvedValue(fakePage) }),
      saveState: jest.fn().mockResolvedValue(undefined),
    } as unknown as BrowserStateManager;

    const rateLimiter = {
      schedule: jest.fn((_accountId: string, fn: () => Promise<unknown>) => fn()),
    } as unknown as AmazonRateLimiter;

    const service = new AmazonScrapingService(
      accountsService,
      parserService,
      browserStateManager,
      rateLimiter,
    );

    const result = await service.scrapeOrderStatusWithTrackingHtml('user-1', 'account-1', 'order-1');

    expect(result.trackingUrl).toBe(
      'https://www.amazon.com/progress-tracker/package/?orderId=111-222&packageIndex=0',
    );
    // Absolute, on the marketplace host, and parseable as a URL on its own —
    // which a relative href is not.
    expect(new URL(result.trackingUrl as string).hostname).toBe('www.amazon.com');
    expect(result.trackingHtml).toBe('<html>ship-track</html>');
    // The value handed onward is the SAME string the page navigated to, so the
    // provider is told about the page we actually read (package index and all).
    expect(fakePage.goto).toHaveBeenNthCalledWith(2, result.trackingUrl, expect.anything());
  });
});

describe('resolveTrustedAmazonTrackingUrl', () => {
  const origin = 'https://www.amazon.com';

  it('absolutizes a relative href against the marketplace origin', () => {
    expect(resolveTrustedAmazonTrackingUrl('/progress-tracker/package/?orderId=1', origin)).toBe(
      'https://www.amazon.com/progress-tracker/package/?orderId=1',
    );
  });

  it('preserves the package index, which is what makes the page unambiguous', () => {
    expect(
      resolveTrustedAmazonTrackingUrl('/gp/your-account/ship-track?orderId=1&packageIndex=2', origin),
    ).toBe('https://www.amazon.com/gp/your-account/ship-track?orderId=1&packageIndex=2');
  });

  it('returns null — never a relative string — for an untrusted host', () => {
    expect(resolveTrustedAmazonTrackingUrl('https://evil.example.com/track', origin)).toBeNull();
  });

  it('returns null for a malformed href without throwing', () => {
    expect(resolveTrustedAmazonTrackingUrl('http://[::1', origin)).toBeNull();
  });

  it('agrees with isTrustedAmazonTrackingUrl on every case', () => {
    const cases = [
      '/progress-tracker/package/?orderId=1',
      'https://www.amazon.com/gp/css/track',
      'https://evil.example.com/track',
      'http://www.amazon.com/gp/css/track',
      'javascript:alert(1)',
      'http://[::1',
    ];
    for (const href of cases) {
      expect(resolveTrustedAmazonTrackingUrl(href, origin) !== null).toBe(
        isTrustedAmazonTrackingUrl(href, origin),
      );
    }
  });
});
