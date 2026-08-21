import type { BillingPlanWithPricingDto } from '@repo/shared';

export interface BillingUsageFormatArgs {
  limit: number;
  unlimitedLabel: string;
  disabledLabel: string;
  locale: string;
}

export interface BillingUsagePlanArgs {
  plan: BillingPlanWithPricingDto;
}

