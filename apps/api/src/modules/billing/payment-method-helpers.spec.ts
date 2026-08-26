import { isCardExpiringSoon } from './payment-method-helpers';

describe('isCardExpiringSoon', () => {
  // A card expires at the END of its month, so 08/2026 is good through 31 Aug.
  it('flags a card expiring inside the window', () => {
    expect(isCardExpiringSoon(9, 2026, new Date('2026-08-22T00:00:00Z'))).toBe(true);
  });

  it('does not flag a card well outside the window', () => {
    expect(isCardExpiringSoon(12, 2034, new Date('2026-08-22T00:00:00Z'))).toBe(false);
  });

  it('flags a card that has already expired', () => {
    // Already dead is more urgent than about to die, never less.
    expect(isCardExpiringSoon(7, 2026, new Date('2026-08-22T00:00:00Z'))).toBe(true);
  });
});
