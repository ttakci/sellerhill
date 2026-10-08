import { buildSparklinePoints } from '@repo/ui';
import { describe, expect, it } from 'vitest';

const parse = (points: string) => points.split(' ').map((p) => p.split(',').map(Number));

describe('buildSparklinePoints', () => {
  it('spreads points across the width and scales max to the top', () => {
    const pts = parse(buildSparklinePoints([0, 5, 10], 100, 30, 0));
    expect(pts).toEqual([[0, 30], [50, 15], [100, 0]]);
  });

  it('draws a flat baseline for all zeros', () => {
    const pts = parse(buildSparklinePoints([0, 0, 0, 0], 100, 30, 0));
    expect(new Set(pts.map(([, y]) => y))).toEqual(new Set([30]));
  });

  it('draws a flat mid line for a constant non-zero series and for a single point', () => {
    expect(new Set(parse(buildSparklinePoints([4, 4, 4], 100, 30, 0)).map(([, y]) => y))).toEqual(new Set([15]));
    const single = parse(buildSparklinePoints([7], 100, 30, 0));
    expect(single).toEqual([[0, 15], [100, 15]]);
  });

  it('handles negatives (net profit) by scaling between min and max', () => {
    const pts = parse(buildSparklinePoints([-10, 0, 10], 100, 20, 0));
    expect(pts.map(([, y]) => y)).toEqual([20, 10, 0]);
  });

  it('returns no NaN for an empty series', () => {
    expect(buildSparklinePoints([], 100, 30, 0)).toBe('0,30 100,30');
  });
});
