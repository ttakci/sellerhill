import type {
  BillingInterval,
  BillingSubscriptionStatus,
  BillingSummaryDto,
} from '@repo/shared';

export interface BillingUsageRow {
  labelKey: string;
  usedDisplay: string;
  ofDisplay: string;
  barValue: number;
  barVariant: 'default' | 'success' | 'warning' | 'error';
  barAriaLabel: string;
}

export interface BillingPlanCard {
  planId: string;
  slug: string;
  priceDisplay: string;
  listingsLimitDisplay: string;
  amazonOrdersLimitDisplay: string;
  isCurrent: boolean;
}

export interface BillingUsageCellViewProps {
  row: BillingUsageRow;
}

export interface BillingPlanCardViewProps {
  plan: BillingPlanCard;
  compareInterval: BillingInterval;
  providerUnconfigured: boolean;
  checkoutPlanId: string | null;
  onCheckout: (planId: string) => void;
}

export interface BillingPageComponentProps {
  isInitialLoading: boolean;
  isUnavailable: boolean;
  onRetry: () => void;
  transition: BillingSummaryDto['transition'] | null;
  enforcementEnabled: boolean;
  providerUnconfigured: boolean;
  subscriptionStatus: BillingSubscriptionStatus | null;
  currentPlanSlug: string | null;
  currentIntervalKey: string | null;
  currentPeriodEndDisplay: string | null;
  usageRows: BillingUsageRow[];
  plans: BillingPlanCard[];
  compareInterval: BillingInterval;
  checkoutPlanId: string | null;
  isPortalLoading: boolean;
  onSelectCompareInterval: (interval: BillingInterval) => void;
  onCheckout: (planId: string) => void;
  onManage: () => void;
}
