import { AmazonOrderParserService, resolveTrackingCarrier } from './amazon-order-parser.service';

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
