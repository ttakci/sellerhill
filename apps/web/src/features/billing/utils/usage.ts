import {
  BILLING_DISABLED,
  BILLING_UNLIMITED,
  BillingLimitKey,
} from '@repo/shared';

import type {
  BillingUsageFormatArgs,
  BillingUsagePlanArgs,
  BillingUsagePeriodArgs,
} from './usage.types';

export function formatBillingLimit(args: BillingUsageFormatArgs): string {
  if (args.limit === BILLING_UNLIMITED) {
    return args.unlimitedLabel;
  }
  if (args.limit === BILLING_DISABLED) {
    return args.disabledLabel;
  }
  return new Intl.NumberFormat(args.locale).format(args.limit);
}

export function usageBarValue(used: number, limit: number): number {
  if (limit === BILLING_UNLIMITED || limit === BILLING_DISABLED || limit <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

export function usageBarVariant(used: number, limit: number) {
  if (limit === BILLING_UNLIMITED || limit === BILLING_DISABLED || limit <= 0) {
    return 'default' as const;
  }
  const percent = (used / limit) * 100;
  if (percent >= 100) {
    return 'error' as const;
  }
  if (percent >= 80) {
    return 'warning' as const;
  }
  return 'success' as const;
}

export function planLimitValue(args: BillingUsagePlanArgs, key: BillingLimitKey): number {
  return args.plan.limits[key]?.limitValue ?? 0;
}

export function usedQtyForPeriod(args: BillingUsagePeriodArgs, key: BillingLimitKey): number {
  const period = args.periods.find((candidate) => String(candidate.limitKey) === String(key));
  return period?.usedQty ?? 0;
}
