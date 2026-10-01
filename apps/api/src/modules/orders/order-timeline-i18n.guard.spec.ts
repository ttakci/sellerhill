// apps/api/src/modules/orders/order-timeline-i18n.guard.spec.ts
//
// The order timeline is sent as codes (`OrderTimelineStepKey`,
// `OrderTimelineNote`) and resolved on the web from `orders.timeline.*`. A code
// with no key renders as the raw key with no error, in whichever of the 15
// locales lacks it — so every code must exist in every locale.

import * as fs from 'fs';
import * as path from 'path';

import { OrderTimelineNote, OrderTimelineStepKey, SUPPORTED_LOCALES } from '@repo/shared';

const LOCALES: string[] = [...SUPPORTED_LOCALES];

interface TimelineStrings {
  title?: string;
  step?: Record<string, string>;
  note?: Record<string, string>;
}

function load(locale: string): TimelineStrings {
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
  const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { orders: { timeline?: TimelineStrings } };
  return json.orders.timeline ?? {};
}

describe('orders.timeline i18n', () => {
  it.each(LOCALES)('%s carries the title, every step label and every note', (locale) => {
    const timeline = load(locale);
    expect({ locale, title: typeof timeline.title }).toEqual({ locale, title: 'string' });
    for (const key of Object.values(OrderTimelineStepKey)) {
      expect({ locale, key, label: typeof timeline.step?.[key] }).toEqual({ locale, key, label: 'string' });
    }
    // `stage` is not a sentence of its own: the web renders the order stage's
    // meaning for it (`orders.stage.<stage>.meaning`, guarded separately).
    for (const note of Object.values(OrderTimelineNote).filter((n) => n !== OrderTimelineNote.STAGE)) {
      expect({ locale, note, text: typeof timeline.note?.[note] }).toEqual({ locale, note, text: 'string' });
    }
  });

  it('carries no key the enums do not know (a renamed code leaves no orphan behind)', () => {
    const stepKeys = Object.values(OrderTimelineStepKey) as string[];
    const noteKeys = Object.values(OrderTimelineNote) as string[];
    for (const locale of LOCALES) {
      const timeline = load(locale);
      expect(Object.keys(timeline.step ?? {}).filter((k) => !stepKeys.includes(k))).toEqual([]);
      expect(Object.keys(timeline.note ?? {}).filter((k) => !noteKeys.includes(k))).toEqual([]);
    }
  });

  it('never names the conversion provider or the product-data provider', () => {
    for (const locale of LOCALES) {
      const text = JSON.stringify(load(locale)).toLowerCase();
      expect({ locale, clean: !/aquiline|keepa|dropship/.test(text) }).toEqual({ locale, clean: true });
    }
  });
});
