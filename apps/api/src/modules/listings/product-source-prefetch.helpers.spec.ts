import { SourceFetchOutcome } from '@repo/shared';

import { buildUnavailablePrefetchMap } from './product-source-prefetch.helpers';

describe('buildUnavailablePrefetchMap', () => {
  it('maps every ASIN to an unavailable/BLOCKED result', () => {
    const map = buildUnavailablePrefetchMap(['B000000001', 'B000000002']);

    expect(map.size).toBe(2);
    expect(map.get('B000000001')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
    expect(map.get('B000000002')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
  });

  it('returns an empty map for an empty input', () => {
    expect(buildUnavailablePrefetchMap([]).size).toBe(0);
  });

  it('never throws, regardless of input shape', () => {
    expect(() => buildUnavailablePrefetchMap(['B000000001', 'B000000001'])).not.toThrow();
    // Duplicate ASINs collapse to one entry — a Map keyed on the ASIN string.
    expect(buildUnavailablePrefetchMap(['B000000001', 'B000000001']).size).toBe(1);
  });
});
