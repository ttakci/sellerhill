import { AmazonMarketplace } from '@repo/shared';

import type { AmazonAccountsService } from './amazon-accounts.service';
import {
  AmazonOrderParserService,
  detectAmazonStatusLine,
  extractTrackingNumberFromText,
  normalizeAmazonStatus,
  resolveTrackingCarrier,
} from './amazon-order-parser.service';
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
    expect(resolveTrackingCarrier('TBA303940404000', 'Join our groups for updates')).toBe('Amazon Logistics');
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
    expect(isTrustedAmazonTrackingUrl('/progress-tracker/package/?orderId=1&packageIndex=0', origin)).toBe(true);
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

    const service = new AmazonScrapingService(accountsService, parserService, browserStateManager, rateLimiter);

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

    const service = new AmazonScrapingService(accountsService, parserService, browserStateManager, rateLimiter);

    const result = await service.scrapeOrderStatusWithTrackingHtml('user-1', 'account-1', 'order-1');

    expect(result.trackingUrl).toBe('https://www.amazon.com/progress-tracker/package/?orderId=111-222&packageIndex=0');
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
      'https://www.amazon.com/progress-tracker/package/?orderId=1'
    );
  });

  it('preserves the package index, which is what makes the page unambiguous', () => {
    expect(resolveTrustedAmazonTrackingUrl('/gp/your-account/ship-track?orderId=1&packageIndex=2', origin)).toBe(
      'https://www.amazon.com/gp/your-account/ship-track?orderId=1&packageIndex=2'
    );
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
      expect(resolveTrustedAmazonTrackingUrl(href, origin) !== null).toBe(isTrustedAmazonTrackingUrl(href, origin));
    }
  });
});

// ---------------------------------------------------------------------------
// First live order (113-0158186-6357035, 2026-09-29). The order-details summary
// reads, as one textContent string:
//   Item(s) Subtotal:$13.91 Shipping & Handling:$0.00 Total before tax:$13.91
//   Estimated tax to be collected:$0.97 Grand Total:$14.88
// The old /tax[:\s]*\$?(\d…)/ matched "Total before tax:$13.91" first, so the
// order was linked with amazon_tax = 13.91 and net_profit = −11.91.
// ---------------------------------------------------------------------------
describe('parseFinancialsFromText against the real Amazon order-summary layout', () => {
  const service = new AmazonOrderParserService();
  const REAL_SUMMARY =
    'Order Summary Item(s) Subtotal:$13.91Shipping & Handling:$0.00Total before tax:$13.91Estimated tax to be collected:$0.97Grand Total:$14.88';

  it('reads the tax from "Estimated tax to be collected", never from "Total before tax"', () => {
    const result = service.parseFinancialsFromText(REAL_SUMMARY);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subtotal).toBeCloseTo(13.91, 2);
      expect(result.shipping).toBe(0);
      expect(result.tax).toBeCloseTo(0.97, 2);
      expect(result.grandTotal).toBeCloseTo(14.88, 2);
    }
  });

  it('reads "Shipping & Handling" as the shipping line', () => {
    const result = service.parseFinancialsFromText(
      'Item(s) Subtotal:$10.00Shipping & Handling:$4.99Total before tax:$14.99Estimated tax to be collected:$1.20Grand Total:$16.19'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.shipping).toBeCloseTo(4.99, 2);
      expect(result.tax).toBeCloseTo(1.2, 2);
      expect(result.grandTotal).toBeCloseTo(16.19, 2);
    }
  });

  it('never lets "Subtotal" feed the grand total when "Grand Total" is absent', () => {
    const result = service.parseFinancialsFromText('Item(s) Subtotal:$13.91 Order Total:$14.88');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.grandTotal).toBeCloseTo(14.88, 2);
    }
  });
});

describe('extractTrackingNumberFromText', () => {
  it('returns the number after a "Tracking ID" label', () => {
    expect(extractTrackingNumberFromText('Tracking ID: TBA303940404000 Shipped with Amazon')).toBe('TBA303940404000');
  });

  it('recognises a real UPS number', () => {
    expect(extractTrackingNumberFromText('Carrier: UPS 1Z999AA10123456784')).toBe('1Z999AA10123456784');
  });

  it('refuses the script-blob string the first live order was stamped with', () => {
    // Uppercase letters after "1Z" with no digits — a real UPS number carries
    // ten digits. This came out of <script> text via page.textContent('body').
    expect(extractTrackingNumberFromText('window.x="1ZAUXFMSEBKUFEFJRA";')).toBeUndefined();
  });

  it('never reads an Amazon order id or a phone number as a tracking number', () => {
    expect(
      extractTrackingNumberFromText('Order # 113-0158186-6357035 Phone 8434081812 Arriving tomorrow')
    ).toBeUndefined();
  });

  it('never returns a lowercase or mixed-case word after "tracking"', () => {
    expect(extractTrackingNumberFromText('tracking information will appear here')).toBeUndefined();
  });
});

describe('normalizeAmazonStatus', () => {
  it('maps the unrecognised "Grand Total:" label to pending, never to itself', () => {
    expect(normalizeAmazonStatus('Grand Total:')).toBe('pending');
  });

  it('treats an ETA ("Arriving tomorrow") as not yet shipped', () => {
    expect(normalizeAmazonStatus('Arriving tomorrow')).toBe('pending');
    expect(normalizeAmazonStatus('Arriving Monday')).toBe('pending');
  });

  it('recognises shipped, out for delivery, delivered and cancelled', () => {
    expect(normalizeAmazonStatus('Shipped')).toBe('shipped');
    expect(normalizeAmazonStatus('Out for delivery')).toBe('shipped');
    expect(normalizeAmazonStatus('On the way')).toBe('shipped');
    expect(normalizeAmazonStatus('Delivered September 30')).toBe('delivered');
    expect(normalizeAmazonStatus('Cancelled')).toBe('cancelled');
  });

  it('keeps "not yet shipped" pre-ship', () => {
    expect(normalizeAmazonStatus('Not yet shipped')).toBe('pending');
    expect(normalizeAmazonStatus('Preparing for shipment')).toBe('processing');
  });
});

describe('resolveTrackingCarrier tightened UPS shape', () => {
  it('does not call a digitless 1Z string UPS', () => {
    expect(resolveTrackingCarrier('1ZAUXFMSEBKUFEFJRA', '')).toBeUndefined();
  });
});

describe('detectAmazonStatusLine — status from the visible page text', () => {
  it('reads the delivery heading of the order-details page', () => {
    expect(detectAmazonStatusLine('Order Details\nArriving tomorrow\nTrack package\nCancel items')).toBe('pending');
    expect(detectAmazonStatusLine('Order Details\nShipped\nTrack package')).toBe('shipped');
    expect(detectAmazonStatusLine('Out for delivery\nTrack package')).toBe('shipped');
    expect(detectAmazonStatusLine('Delivered September 30\nHow was your delivery?')).toBe('delivered');
    expect(detectAmazonStatusLine('Not yet shipped\nCancel items')).toBe('pending');
    expect(detectAmazonStatusLine('Preparing for shipment')).toBe('processing');
  });

  it('never reads the "Cancel items" button or "Return or replace items" as a status', () => {
    expect(detectAmazonStatusLine('Cancel items\nReturn or replace items\nWrite a product review')).toBeUndefined();
  });

  it('reads a real cancellation', () => {
    expect(detectAmazonStatusLine('Cancelled\nYour order was cancelled')).toBe('cancelled');
    expect(detectAmazonStatusLine('Canceled')).toBe('cancelled');
  });

  it('ignores long lines — a product title mentioning "shipped" is not a status', () => {
    expect(
      detectAmazonStatusLine('Shipped in original packaging, extra long product title that goes on and on and on')
    ).toBeUndefined();
  });

  it('returns undefined when nothing recognisable is on the page', () => {
    expect(detectAmazonStatusLine('Secure checkout\nBack to top')).toBeUndefined();
    expect(detectAmazonStatusLine('')).toBeUndefined();
  });
});

describe('AmazonScrapingService.scrapeOrderStatusWithTrackingHtml — reads the ship-track page too', () => {
  function buildService(opts: {
    parsed: { status: string; trackingNumber?: string; trackingCarrier?: string; trackingUrl?: string };
    shipTrackText: string;
  }) {
    const fakePage = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html>ship-track</html>'),
      close: jest.fn().mockResolvedValue(undefined),
      locator: jest.fn(() => ({ innerText: jest.fn().mockResolvedValue(opts.shipTrackText) })),
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
      parseOrderStatus: jest.fn().mockResolvedValue(opts.parsed),
    } as unknown as AmazonOrderParserService;
    const browserStateManager = {
      isSessionValid: jest.fn().mockResolvedValue(true),
      getContext: jest.fn().mockResolvedValue({ newPage: jest.fn().mockResolvedValue(fakePage) }),
      saveState: jest.fn().mockResolvedValue(undefined),
    } as unknown as BrowserStateManager;
    const rateLimiter = {
      schedule: jest.fn((_accountId: string, fn: () => Promise<unknown>) => fn()),
    } as unknown as AmazonRateLimiter;
    return new AmazonScrapingService(accountsService, parserService, browserStateManager, rateLimiter);
  }

  it('takes the tracking number and carrier from the ship-track page when order-details has none', async () => {
    // Amazon prints "Tracking ID" on the progress tracker, not on order-details.
    const service = buildService({
      parsed: { status: 'shipped', trackingUrl: '/progress-tracker/package/?orderId=1&packageIndex=0' },
      shipTrackText: 'Shipped\nShipped with Amazon\nTracking ID: TBA303940404000\n',
    });
    const result = await service.scrapeOrderStatusWithTrackingHtml('user-1', 'account-1', 'order-1');
    expect(result.trackingNumber).toBe('TBA303940404000');
    expect(result.trackingCarrier).toBe('Amazon Logistics');
  });

  it('falls back to the ship-track page status when order-details yielded nothing usable', async () => {
    const service = buildService({
      parsed: { status: 'pending', trackingUrl: '/progress-tracker/package/?orderId=1&packageIndex=0' },
      shipTrackText: 'Out for delivery\nTracking ID: TBA303940404000',
    });
    const result = await service.scrapeOrderStatusWithTrackingHtml('user-1', 'account-1', 'order-1');
    expect(result.status).toBe('shipped');
  });

  it('never lets the ship-track page downgrade a status order-details already read', async () => {
    const service = buildService({
      parsed: { status: 'delivered', trackingUrl: '/progress-tracker/package/?orderId=1&packageIndex=0' },
      shipTrackText: 'Arriving tomorrow',
    });
    const result = await service.scrapeOrderStatusWithTrackingHtml('user-1', 'account-1', 'order-1');
    expect(result.status).toBe('delivered');
  });
});
