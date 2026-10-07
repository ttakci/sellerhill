import { DashboardPeriodUnit as U, DashboardRangePreset as P } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { periodLabelKey } from './periodLabels';

describe('periodLabelKey', () => {
  it.each([
    [{ unit: U.DAY, offset: 0, preset: P.TODAY }, { key: 'dashboard.periodLabel.day.current' }],
    [{ unit: U.DAY, offset: 1, preset: null }, { key: 'dashboard.periodLabel.day.previous' }],
    [{ unit: U.DAY, offset: 3, preset: null }, { key: 'dashboard.periodLabel.day.ago', count: 3 }],
    [{ unit: U.MONTH, offset: 0, preset: P.THIS_MONTH }, { key: 'dashboard.periodLabel.month.current' }],
    [{ unit: U.SPAN, offset: 0, preset: P.LAST_7_DAYS }, { key: 'dashboard.range.preset.last7Days' }],
    [{ unit: U.SPAN, offset: 1, preset: null }, null],
    [{ unit: U.SPAN, offset: 0, preset: null }, null],
  ])('%j → %j', (label, expected) => {
    expect(periodLabelKey(label)).toEqual(expected);
  });
});
