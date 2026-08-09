import {
  applyListingOverrides,
  hasCommerceDelta,
  type ListingOverrideRow,
  type StrategyCommerce,
} from './listing-pricing.helpers';

const strategy: StrategyCommerce = {
  price: 25,
  quantity: 4,
  purchasePrice: 10,
  estimatedProfit: 15,
  profitMargin: 60,
  roi: 150,
};

/** A row with every automation flag off — the "no overrides" baseline. */
function row(overrides: Partial<ListingOverrideRow> = {}): ListingOverrideRow {
  return {
    price: '20.00',
    quantity: 2,
    disable_ordering: false,
    disable_repricing: false,
    lock_price: false,
    lock_quantity: false,
    price_override: null,
    quantity_override: null,
    margin_percent_override: null,
    margin_fixed_override: null,
    ...overrides,
  };
}

describe('applyListingOverrides', () => {
  it('passes the strategy through untouched when no override is set', () => {
    expect(applyListingOverrides(strategy, row())).toEqual(strategy);
  });

  describe('quantity', () => {
    it('forces 0 when ordering is disabled', () => {
      expect(applyListingOverrides(strategy, row({ disable_ordering: true })).quantity).toBe(0);
    });

    it('lets disable_ordering outrank a locked quantity', () => {
      const result = applyListingOverrides(
        strategy,
        row({ disable_ordering: true, lock_quantity: true, quantity_override: 9 })
      );
      expect(result.quantity).toBe(0);
    });

    it('pins the override when quantity is locked', () => {
      expect(applyListingOverrides(strategy, row({ lock_quantity: true, quantity_override: 9 })).quantity).toBe(9);
    });

    it('falls back to the listing current quantity when locked with no override', () => {
      expect(applyListingOverrides(strategy, row({ lock_quantity: true, quantity: 3 })).quantity).toBe(3);
    });

    it('treats a locked quantity of zero as a real value, not a missing one', () => {
      expect(applyListingOverrides(strategy, row({ lock_quantity: true, quantity_override: 0 })).quantity).toBe(0);
    });
  });

  describe('locked price', () => {
    it('uses the price override and recomputes profit against Amazon cost', () => {
      const result = applyListingOverrides(strategy, row({ lock_price: true, price_override: '30.00' }));
      expect(result.price).toBe(30);
      expect(result.purchasePrice).toBe(10);
      expect(result.estimatedProfit).toBe(20);
      expect(result.profitMargin).toBeCloseTo(66.667, 3);
      expect(result.roi).toBe(200);
    });

    it('falls back to the listing current price when locked with no override', () => {
      expect(applyListingOverrides(strategy, row({ lock_price: true })).price).toBe(20);
    });

    it('treats disable_repricing the same as lock_price', () => {
      expect(applyListingOverrides(strategy, row({ disable_repricing: true })).price).toBe(20);
    });

    it('keeps the strategy price when locked but nothing is on record to pin', () => {
      expect(applyListingOverrides(strategy, row({ lock_price: true, price: null })).price).toBe(25);
    });

    it('reports a zero margin rather than dividing by zero at price 0', () => {
      const result = applyListingOverrides(strategy, row({ lock_price: true, price_override: 0 }));
      expect(result.price).toBe(0);
      expect(result.profitMargin).toBe(0);
    });
  });

  describe('margin override', () => {
    it('applies a percent margin on top of Amazon cost', () => {
      const result = applyListingOverrides(strategy, row({ margin_percent_override: '50' }));
      expect(result.price).toBe(15);
      expect(result.estimatedProfit).toBe(5);
      expect(result.roi).toBe(50);
    });

    it('applies a fixed margin on top of Amazon cost', () => {
      expect(applyListingOverrides(strategy, row({ margin_fixed_override: '4.50' })).price).toBe(14.5);
    });

    it('combines percent and fixed', () => {
      expect(
        applyListingOverrides(strategy, row({ margin_percent_override: '50', margin_fixed_override: '2' })).price
      ).toBe(17);
    });

    it('is ignored when the price is locked', () => {
      const result = applyListingOverrides(
        strategy,
        row({ lock_price: true, price_override: '30.00', margin_percent_override: '50' })
      );
      expect(result.price).toBe(30);
    });

    it('honours an explicit zero percent instead of treating it as unset', () => {
      expect(applyListingOverrides(strategy, row({ margin_percent_override: 0 })).price).toBe(10);
    });
  });
});

describe('hasCommerceDelta', () => {
  it('does not treat NUMERIC string formatting as a change', () => {
    // The regression this helper exists for: "12.30" vs 12.3 used to compare
    // unequal as strings and push a no-op update to eBay every refresh cycle.
    expect(hasCommerceDelta({ price: '12.30', quantity: 2 }, { price: 12.3, quantity: 2 })).toBe(false);
  });

  it('ignores sub-cent drift', () => {
    expect(hasCommerceDelta({ price: '12.30', quantity: 2 }, { price: 12.302, quantity: 2 })).toBe(false);
  });

  it('detects a one-cent price change', () => {
    expect(hasCommerceDelta({ price: '12.30', quantity: 2 }, { price: 12.31, quantity: 2 })).toBe(true);
  });

  it('detects a quantity change', () => {
    expect(hasCommerceDelta({ price: '12.30', quantity: 2 }, { price: 12.3, quantity: 3 })).toBe(true);
  });

  it('treats an unknown current price as changed', () => {
    expect(hasCommerceDelta({ price: null, quantity: 2 }, { price: 12.3, quantity: 2 })).toBe(true);
  });

  it('treats an unknown current quantity as changed', () => {
    expect(hasCommerceDelta({ price: '12.30', quantity: null }, { price: 12.3, quantity: 2 })).toBe(true);
  });
});
