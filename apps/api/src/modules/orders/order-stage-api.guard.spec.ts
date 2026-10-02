// apps/api/src/modules/orders/order-stage-api.guard.spec.ts
//
// The list filter, the default sort, the DTO field and the tab counts must
// all read the SAME stage expression (`buildOrderStageSql`) — a hand-written
// predicate at any of these sites is how a row ends up listed under a tab
// whose badge it does not carry.

import * as fs from 'fs';
import * as path from 'path';

function read(file: string): string {
  return fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('orders API — stage', () => {
  const service = read('orders.service.ts');
  const controller = read('orders.controller.ts');

  it('filters the list through buildOrderStageSql, never a hand-written predicate', () => {
    const findAll = service.slice(service.indexOf('async findAll('));
    const body = findAll.slice(0, findAll.indexOf('\n  }\n'));
    expect(body).toMatch(/buildOrderStageSql\('o'\)\} = ANY\(\$/);
  });

  it('sorts what needs the seller first when the caller did not choose a sort', () => {
    expect(service).toMatch(/CASE WHEN \$\{buildNeedsActionSql\('o'\)\} THEN 0/);
    expect(service).toMatch(/THEN 0 ELSE 1 END, o\.order_date DESC/);
  });

  it('maps stage onto the DTO through deriveOrderStage with both 089 timestamps', () => {
    const map = service.slice(service.indexOf('private mapRowToDto('));
    expect(map).toMatch(/const stage = deriveOrderStage\(\{/);
    expect(map).toMatch(/shippedDetectedAt: row\.shipped_detected_at/);
    expect(map).toMatch(/ebayTrackingPushedAt: row\.ebay_tracking_pushed_at/);
  });

  it('counts stages with one GROUP BY over the same expression', () => {
    const counts = service.slice(service.indexOf('async getStageCounts('));
    expect(counts).toMatch(/GROUP BY 1/);
    expect(counts).toMatch(/buildOrderStageSql\('o'\)/);
  });

  it('counts the Needs-action tab with the predicate the tab filters on', () => {
    const counts = service.slice(service.indexOf('async getStageCounts('));
    const body = counts.slice(0, counts.indexOf('\n  }\n'));
    expect(body).toMatch(/buildNeedsActionSql\('o'\)/);
    const findAll = service.slice(service.indexOf('async findAll('));
    expect(findAll.slice(0, findAll.indexOf('\n  }\n'))).toMatch(/conditions\.push\(buildNeedsActionSql\('o'\)\)/);
  });

  it('drops unknown ship-by values instead of forwarding them', () => {
    expect(controller).toMatch(/Object\.values\(OrderShipByState\)/);
  });

  it('never lets order sync write the seller note', () => {
    expect(read('order-sync.service.ts')).not.toMatch(/seller_note/);
  });

  it('drops unknown stage values instead of forwarding them', () => {
    expect(controller).toMatch(/Object\.values\(OrderStage\)/);
  });

  it('exposes GET /orders/stage-counts before the :id route', () => {
    const counts = controller.indexOf("@Get('stage-counts')");
    const byId = controller.indexOf("@Get(':id')");
    expect(counts).toBeGreaterThan(-1);
    expect(counts).toBeLessThan(byId);
  });
});
