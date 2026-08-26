import {
  AQUILINE_TRACKING_NUMBER_PATTERN,
  AquilineProblemCode,
  isAquilineProblemCode,
} from '@repo/shared';

describe('Aquiline vocabulary', () => {
  it('accepts the AQUA number shapes attested by the provider', () => {
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('AQUAA6435850826YQ')).toBe(true);
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('AQUA0000000000YQ')).toBe(true);
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('TBA303940404000')).toBe(false);
  });

  it('carries every public problem code from the API document', () => {
    expect(Object.values(AquilineProblemCode).sort()).toEqual(
      [
        'amazon_session_expired',
        'assign_validation',
        'needs_tracking_upload',
        'shipment_exception',
        'tracking_update_unavailable',
        'tracking_url_mismatch',
        'update_not_applied',
        'wrong_page_type',
      ].sort(),
    );
  });

  it('narrows an unknown provider string safely', () => {
    expect(isAquilineProblemCode('wrong_page_type')).toBe(true);
    expect(isAquilineProblemCode('something_new_they_added')).toBe(false);
  });
});
