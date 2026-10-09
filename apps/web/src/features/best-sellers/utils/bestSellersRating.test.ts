import { describe, expect, it } from 'vitest';

import { toStarFills } from './bestSellersRating';

describe('toStarFills', () => {
  it('rounds to the nearest half star', () => {
    expect(toStarFills(4.6)).toEqual(['full', 'full', 'full', 'full', 'half']);
    expect(toStarFills(4.8)).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(toStarFills(4.2)).toEqual(['full', 'full', 'full', 'full', 'empty']);
    expect(toStarFills(3.5)).toEqual(['full', 'full', 'full', 'half', 'empty']);
  });

  it('stays within zero and five stars', () => {
    expect(toStarFills(0)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
    expect(toStarFills(7)).toEqual(['full', 'full', 'full', 'full', 'full']);
    expect(toStarFills(-1)).toEqual(['empty', 'empty', 'empty', 'empty', 'empty']);
  });
});
