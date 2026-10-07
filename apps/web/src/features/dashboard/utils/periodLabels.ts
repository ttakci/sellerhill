/**
 * Which i18n key names a period card. `null` = no name, render the dates
 * (a custom range, or the earlier windows of a rolling preset).
 */
import { DashboardPeriodUnit, type DashboardPeriodLabel } from '@repo/shared';

import type { PeriodLabelKey } from '../dashboard.types';

export function periodLabelKey(label: DashboardPeriodLabel): PeriodLabelKey | null {
  if (label.unit === DashboardPeriodUnit.SPAN) {
    return label.offset === 0 && label.preset ? { key: `dashboard.range.preset.${label.preset}` } : null;
  }
  const base = `dashboard.periodLabel.${label.unit}`;
  if (label.offset === 0) {
    return { key: `${base}.current` };
  }
  if (label.offset === 1) {
    return { key: `${base}.previous` };
  }
  return { key: `${base}.ago`, count: label.offset };
}
