import { isCreateCacheFresh } from './create-cache-freshness';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-09-28T17:00:00Z');

describe('isCreateCacheFresh', () => {
  it('accepts a row refreshed inside the window', () => {
    expect(isCreateCacheFresh({ updatedAt: '2026-09-28T15:00:00Z' }, NOW, 6 * HOUR)).toBe(true);
  });

  it('rejects a row older than the window — it must be re-fetched before it is listed', () => {
    // A product whose earlier listing attempts failed has no ACTIVE listing,
    // so the refresh never visits it: its row can be days old and describe a
    // product Amazon has since removed. Two such ASINs were published live.
    expect(isCreateCacheFresh({ updatedAt: '2026-09-27T09:00:00Z' }, NOW, 6 * HOUR)).toBe(false);
  });

  it('rejects a row the source already reported removed, whatever its age', () => {
    expect(isCreateCacheFresh({ updatedAt: '2026-09-28T16:59:00Z', sourceRemoved: true }, NOW, 6 * HOUR)).toBe(
      false
    );
  });

  it('rejects a row with no timestamp — unknown age is not fresh', () => {
    expect(isCreateCacheFresh({}, NOW, 6 * HOUR)).toBe(false);
    expect(isCreateCacheFresh({ updatedAt: 'not a date' }, NOW, 6 * HOUR)).toBe(false);
  });

  it('a non-finite or non-positive window never accepts anything', () => {
    // A misread setting must fail towards a re-fetch, never towards serving
    // stale data for ever.
    expect(isCreateCacheFresh({ updatedAt: '2026-09-28T16:59:00Z' }, NOW, Number.NaN)).toBe(false);
    expect(isCreateCacheFresh({ updatedAt: '2026-09-28T16:59:00Z' }, NOW, 0)).toBe(false);
  });
});
