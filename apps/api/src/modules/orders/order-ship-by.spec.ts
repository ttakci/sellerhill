// apps/api/src/modules/orders/order-ship-by.spec.ts
//
// eBay's ship-by deadline is a flag BESIDE the stage. The TypeScript rule
// (the DTO's `shipByState`) and the SQL rule (the list filter, the
// Needs-action tab and its count, the Action Center item) must name the same
// stages, or a row carries a "late" chip the filter does not return.

import {
  ACTIONABLE_ORDER_STAGES,
  OrderShipByState,
  OrderStage,
  SHIP_BY_DUE_SOON_HOURS,
  STAGES_AWAITING_EBAY_SHIPMENT,
  buildNeedsActionSql,
  buildShipByStateSql,
  deriveShipByState,
  orderNeedsAction,
} from '@repo/shared';

const now = new Date('2026-10-02T12:00:00Z');
const hours = (n: number): string => new Date(now.getTime() + n * 3_600_000).toISOString();

describe('deriveShipByState', () => {
  it('is late once the date has passed, due soon inside the window, nothing before it', () => {
    const stage = OrderStage.TO_PURCHASE;
    expect(deriveShipByState({ stage, shipByDate: hours(-1), now })).toBe(OrderShipByState.LATE);
    expect(deriveShipByState({ stage, shipByDate: hours(SHIP_BY_DUE_SOON_HOURS - 1), now })).toBe(
      OrderShipByState.DUE_SOON
    );
    expect(deriveShipByState({ stage, shipByDate: hours(SHIP_BY_DUE_SOON_HOURS + 1), now })).toBeNull();
  });

  it('has no deadline without a date, or with one that cannot be read', () => {
    expect(deriveShipByState({ stage: OrderStage.PURCHASED, shipByDate: null, now })).toBeNull();
    expect(deriveShipByState({ stage: OrderStage.PURCHASED, shipByDate: 'not a date', now })).toBeNull();
  });

  it.each([OrderStage.SHIPPED, OrderStage.DELIVERED, OrderStage.CANCELLED, OrderStage.AWAITING_PAYMENT])(
    'never flags %s — nothing is left to be late with',
    (stage) => {
      expect(deriveShipByState({ stage, shipByDate: hours(-48), now })).toBeNull();
    }
  );

  it.each([...STAGES_AWAITING_EBAY_SHIPMENT])('flags %s while eBay still awaits a shipment', (stage) => {
    expect(deriveShipByState({ stage, shipByDate: hours(-48), now })).toBe(OrderShipByState.LATE);
  });
});

describe('ship-by SQL', () => {
  const stagesIn = (sql: string): string[] => {
    const list = /END IN \(([^)]*)\)\)$/.exec(sql);
    return list ? list[1].split(', ').map((s) => s.replace(/'/g, '')) : [];
  };

  it('names exactly the stages the TypeScript rule flags', () => {
    expect(stagesIn(buildShipByStateSql('o', OrderShipByState.LATE))).toEqual([...STAGES_AWAITING_EBAY_SHIPMENT]);
    expect(stagesIn(buildShipByStateSql('o', OrderShipByState.DUE_SOON))).toEqual([...STAGES_AWAITING_EBAY_SHIPMENT]);
  });

  it('splits late and due-soon at NOW(), with the same window as the TypeScript rule', () => {
    expect(buildShipByStateSql('o', OrderShipByState.LATE)).toContain('o.ebay_ship_by_date < NOW()');
    expect(buildShipByStateSql('o', OrderShipByState.DUE_SOON)).toContain(
      `o.ebay_ship_by_date >= NOW() AND o.ebay_ship_by_date < NOW() + INTERVAL '${SHIP_BY_DUE_SOON_HOURS} hours'`
    );
  });

  it('needs-action = an actionable stage OR a missed deadline, in SQL and in TypeScript', () => {
    const sql = buildNeedsActionSql('o');
    for (const stage of ACTIONABLE_ORDER_STAGES) {
      expect(sql).toContain(`'${stage}'`);
    }
    expect(sql).toContain(` OR ${buildShipByStateSql('o', OrderShipByState.LATE)}`);
    expect(orderNeedsAction(OrderStage.PURCHASE_BLOCKED, null)).toBe(true);
    expect(orderNeedsAction(OrderStage.PURCHASED, OrderShipByState.LATE)).toBe(true);
    expect(orderNeedsAction(OrderStage.PURCHASED, OrderShipByState.DUE_SOON)).toBe(false);
    expect(orderNeedsAction(OrderStage.SHIPPED, null)).toBe(false);
  });
});
