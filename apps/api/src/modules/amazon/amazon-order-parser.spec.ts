import { AmazonOrderParserService } from './amazon-order-parser.service';

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
