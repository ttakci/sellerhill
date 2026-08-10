import type { BillingPlanWithPricingDto, BillingUsagePeriodDto } from '@repo/shared';

export interface BillingUsageFormatArgs {
  limit: number;
  unlimitedLabel: string;
  disabledLabel: string;
  locale: string;
}

export interface BillingUsagePlanArgs {
  plan: BillingPlanWithPricingDto;
}

export interface BillingUsagePeriodArgs {
  periods: BillingUsagePeriodDto[];
}
