// apps/api/src/modules/orders/order-stage-i18n.guard.spec.ts
//
// Every stage renders a label and a meaning sentence (badge + tooltip +
// legend), and the four stages a seller can act on render an action
// sentence — in all 16 locales. A missing key renders as the raw key with no
// error, which is how a Turkish seller ends up reading
// "orders.stage.tracking_held.label".

import * as fs from 'fs';
import * as path from 'path';

import { OrderStage, OrderStageTab, SUPPORTED_LOCALES } from '@repo/shared';

// `it.each` over a readonly tuple types the parameter as `any`; a plain
// string array keeps `locale` a string.
const LOCALES: string[] = [...SUPPORTED_LOCALES];

const ACTION_STAGES = [
  OrderStage.AMAZON_CANCELLED,
  OrderStage.TRACKING_HELD,
  OrderStage.PURCHASE_UNKNOWN,
  OrderStage.PURCHASE_BLOCKED,
  OrderStage.TO_PURCHASE,
];

function load(locale: string): Record<string, unknown> {
  const file = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    '..',
    'packages',
    'shared',
    'src',
    'i18n',
    'resources',
    locale,
    'orders.json'
  );
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { orders: Record<string, unknown> }).orders;
}

describe('orders.stage i18n', () => {
  it.each(LOCALES)('%s carries label + meaning for every stage, action where one exists', (locale) => {
    const stage = load(locale).stage as Record<string, Record<string, string>>;
    for (const s of Object.values(OrderStage)) {
      // Booleans rather than `expect.any(String)`, which is typed `any` and
      // trips the unsafe-assignment lint; the locale and stage ride along so a
      // failure names the missing key.
      expect({ locale, s, label: typeof stage[s]?.label }).toEqual({ locale, s, label: 'string' });
      expect({ locale, s, meaning: typeof stage[s]?.meaning }).toEqual({ locale, s, meaning: 'string' });
      if (ACTION_STAGES.includes(s)) {
        expect({ locale, s, action: typeof stage[s]?.action }).toEqual({ locale, s, action: 'string' });
      }
    }
  });

  it.each(LOCALES)('%s carries every tab and the legend strings', (locale) => {
    const o = load(locale);
    const tabs = o.stageTabs as Record<string, string>;
    for (const tab of Object.values(OrderStageTab)) {
      expect({ locale, tab, label: typeof tabs[tab] }).toEqual({ locale, tab, label: 'string' });
    }
    const legend = o.stageLegend as Record<string, string>;
    for (const k of ['title', 'open', 'columnStage', 'columnMeaning', 'columnAction']) {
      expect({ locale, k, v: typeof legend[k] }).toEqual({ locale, k, v: 'string' });
    }
    expect(typeof (o.filters as Record<string, string>).allStages).toBe('string');
    expect(typeof (o.detail as Record<string, string>).ebayStatus).toBe('string');
  });
});
