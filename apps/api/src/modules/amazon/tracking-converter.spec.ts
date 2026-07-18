import { TrackingConversionProvider } from '@repo/shared';

import { ApiTrackingConverter, LocalTrackingConverter, resolveConverter } from './tracking-converter';

const conv = new LocalTrackingConverter();

describe('LocalTrackingConverter', () => {
  it('remaps real UPS', () => {
    expect(conv.convert('1Z999AA10123456784', 'UPS')).toEqual({
      trackingNumber: '1Z999AA10123456784', shippingCarrierCode: 'UPS',
    });
  });
  it('remaps real USPS (case-insensitive carrier)', () => {
    expect(conv.convert('9400111899223100000000', 'U.S. Postal Service')).toEqual({
      trackingNumber: '9400111899223100000000', shippingCarrierCode: 'USPS',
    });
  });
  it('remaps FedEx and DHL', () => {
    expect(conv.convert('12345', 'FedEx').shippingCarrierCode).toBe('FedEx');
    expect(conv.convert('12345', 'DHL').shippingCarrierCode).toBe('DHL_Express');
  });
  it('passes TBA through as Amazon_Logistics (NO fabrication)', () => {
    const r = conv.convert('TBA123456789', 'Amazon Logistics');
    expect(r).toEqual({ trackingNumber: 'TBA123456789', shippingCarrierCode: 'Amazon_Logistics' });
    // regression guard: the number is unchanged — never rewritten into a fake USPS/UPS number
    expect(r.trackingNumber).toBe('TBA123456789');
  });
  it('detects TBA by number prefix even with empty carrier', () => {
    expect(conv.convert('TBM000111222', '').shippingCarrierCode).toBe('Amazon_Logistics');
  });
  it('passes unknown real carrier through under raw label', () => {
    const r = conv.convert('ABC123', 'OnTrac');
    expect(r.trackingNumber).toBe('ABC123');
    expect(['OnTrac', 'Other']).toContain(r.shippingCarrierCode);
  });
});

describe('resolveConverter', () => {
  it('returns Local for LOCAL', () => {
    expect(resolveConverter(TrackingConversionProvider.LOCAL)).toBeInstanceOf(LocalTrackingConverter);
  });
  it('returns Api stub for API', () => {
    expect(resolveConverter(TrackingConversionProvider.API)).toBeInstanceOf(ApiTrackingConverter);
  });
  it('Api stub throws NotImplemented on convert', () => {
    expect(() => resolveConverter(TrackingConversionProvider.API).convert('x', 'y')).toThrow();
  });
});
