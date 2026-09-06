// apps/web/src/features/billing/utils/usageRows.ts
//
// The one place the three-meter usage list is assembled from a billing summary.
// Shared by the Billing page (its "Usage this period" block) and the top-right
// profile dropdown (a glanceable shortcut) so the two surfaces can never show
// different figures for the same quota.

import { BillingLimitKey, type BillingSummaryDto } from '@repo/shared';
import type { TFunction } from 'i18next';

import { formatBillingLimit, planLimitValue, usageBarValue, usageBarVariant } from './usage';
import type { BillingUsageRow } from './usageRows.types';

export type { BillingUsageRow } from './usageRows.types';

/**
 * Order matters: listings first (a level), then tracking conversions (the
 * metered, priced dimension), then automatic orders (a ceiling). Same order as
 * the plan cards on the Billing page.
 */
const USAGE_LIMIT_KEYS: readonly BillingLimitKey[] = [
  BillingLimitKey.LISTINGS_PER_MONTH,
  BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH,
  BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
];

/**
 * Build the per-meter display rows for a billing summary.
 *
 * Returns `[]` unless there is a subscription (a trial counts) AND a resolved
 * plan — a brand-new account with neither has no usage to show. Every figure
 * comes from `summary.quotas`: `limitValue` is the EFFECTIVE ceiling (plan
 * allowance + any top-up bought this month, the number the gate enforces) and
 * `used` is computed live, so the meters cannot disagree with a refusal.
 */
export function buildBillingUsageRows(
  summary: BillingSummaryDto | undefined,
  t: TFunction,
  locale: string,
): BillingUsageRow[] {
  if (!summary || !summary.subscription || !summary.plan) {
    return [];
  }
  const plan = summary.plan;
  const unlimitedLabel = t('billing:billing.limits.unlimited');
  const disabledLabel = t('billing:billing.limits.disabled');
  const quotaByKey = new Map(summary.quotas.map((quota) => [quota.limitKey, quota]));

  const rows: BillingUsageRow[] = [];
  for (const key of USAGE_LIMIT_KEYS) {
    const quota = quotaByKey.get(key);
    const limit = quota?.limitValue ?? planLimitValue({ plan }, key);
    const used = quota?.used ?? 0;
    const labelKey = `billing:billing.limits.${key}.label`;
    const limitDisplay = formatBillingLimit({ limit, unlimitedLabel, disabledLabel, locale });
    const usedDisplay = new Intl.NumberFormat(locale).format(used);
    const ofDisplay = t('billing:billing.limits.of', { used: usedDisplay, limit: limitDisplay });
    const ringLabel = limit > 0 ? `${Math.min(999, Math.round((used / limit) * 100))}%` : '—';
    rows.push({
      ringLabel,
      labelKey,
      usedDisplay,
      ofDisplay,
      barValue: usageBarValue(used, limit),
      barVariant: usageBarVariant(used, limit),
      barAriaLabel: `${t(labelKey)}: ${usedDisplay} / ${limitDisplay}`,
    });
  }
  return rows;
}
