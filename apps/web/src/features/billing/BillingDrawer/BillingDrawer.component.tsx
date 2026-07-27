// apps/web/src/features/billing/BillingDrawer/BillingDrawer.component.tsx
//
// Presentation-only. Allowed hooks: useTranslation. No RTK Query, no
// useState/useEffect, no formatters (Intl.NumberFormat / formatCurrency) — the
// container pre-formats every value into display strings. The only logic here
// is the subscription-status → BadgeVariant map (pure, module-scope, no hook).

import { BillingInterval, BillingSubscriptionStatus } from '@repo/shared';
import {
  Badge,
  type BadgeVariant,
  Button,
  Drawer,
  Icon,
  ProgressBar,
  SegmentedControl,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  BodyStack,
  CompareHeaderRow,
  PlanCard,
  PlanCardFooter,
  PlanCardHeader,
  PlanFeatureItem,
  PlanFeatureList,
  PlanHeaderRow,
  PlanNameStack,
  PlanPriceRow,
  PricingGrid,
  ProviderNotice,
  SectionCard,
  UsageCell,
  UsageGrid,
  UsageValueRow,
} from './BillingDrawer.style';
import type {
  BillingDrawerComponentProps,
  BillingPlanCard,
  BillingUsageRow,
} from './BillingDrawer.types';

/** Map a subscription status to a Badge variant. Pure, no hook deps. */
function statusBadgeVariant(status: BillingSubscriptionStatus): BadgeVariant {
  switch (status) {
    case BillingSubscriptionStatus.ACTIVE:
    case BillingSubscriptionStatus.TRIALING:
      return 'success';
    case BillingSubscriptionStatus.PAST_DUE:
      return 'warning';
    case BillingSubscriptionStatus.CANCELED:
    case BillingSubscriptionStatus.ENDED:
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Render a single usage cell: label, used/limit, progress bar. */
function UsageCellView({
  row,
  t,
}: {
  row: BillingUsageRow;
  t: (key: string, params?: Record<string, string | number>) => string;
}): React.ReactElement {
  return (
    <UsageCell>
      <Text variant="body-sm" weight="semibold">{t(row.labelKey)}</Text>
      <UsageValueRow>
        <Text variant="h4" weight="semibold">{row.usedDisplay}</Text>
        <Text variant="body-sm" muted>{row.ofDisplay}</Text>
      </UsageValueRow>
      <ProgressBar
        value={row.barValue}
        variant={row.barVariant}
        size="sm"
        label={row.barAriaLabel}
      />
    </UsageCell>
  );
}

/** Render a single plan comparison card. */
function PlanCardView({
  plan,
  compareInterval,
  providerUnconfigured,
  isActionLoading,
  onCheckout,
  t,
}: {
  plan: BillingPlanCard;
  compareInterval: BillingInterval;
  providerUnconfigured: boolean;
  isActionLoading: boolean;
  onCheckout: (planId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}): React.ReactElement {
  const periodKey = compareInterval === BillingInterval.MONTHLY
    ? 'billing:billing.plans.perMonth'
    : 'billing:billing.plans.perYear';
  const nameKey = `billing:billing.plans.${plan.slug}.name`;
  const descriptionKey = `billing:billing.plans.${plan.slug}.description`;
  const ctaLabel = plan.isCurrent
    ? t('billing:billing.plans.currentPlan')
    : t('billing:billing.plans.choosePlan', { plan: t(nameKey) });
  return (
    <PlanCard $highlight={plan.isHighlighted} variant="bordered">
      <PlanCardHeader>
        <Text variant="h4" weight="semibold">{t(nameKey)}</Text>
        {plan.isHighlighted ? (
          <Badge variant="primary" size="xs" isPill>{t('billing:billing.plans.mostPopular')}</Badge>
        ) : null}
      </PlanCardHeader>
      <Text variant="body-sm" muted>{t(descriptionKey)}</Text>
      <PlanPriceRow>
        <Text variant="h3" weight="semibold">{plan.priceDisplay}</Text>
        <Text variant="body-sm" muted>{t(periodKey)}</Text>
      </PlanPriceRow>
      <PlanFeatureList>
        <PlanFeatureItem>
          <Icon name="check-circle" size={16} color="semantic.success" />
          <Text variant="body-sm">
            {t('billing:billing.limits.listings_per_month.label')}: {plan.listingsLimitDisplay}
          </Text>
        </PlanFeatureItem>
        <PlanFeatureItem>
          <Icon name="check-circle" size={16} color="semantic.success" />
          <Text variant="body-sm">
            {t('billing:billing.limits.amazon_orders_per_month.label')}: {plan.amazonOrdersLimitDisplay}
          </Text>
        </PlanFeatureItem>
      </PlanFeatureList>
      <PlanCardFooter>
        <Button
          variant={plan.isHighlighted ? 'primary' : 'secondary'}
          size="medium"
          fullWidth
          disabled={plan.isCurrent || providerUnconfigured}
          isLoading={isActionLoading && !plan.isCurrent}
          onClick={() => onCheckout(plan.planId)}
        >
          <Text variant="body-sm">{ctaLabel}</Text>
        </Button>
      </PlanCardFooter>
    </PlanCard>
  );
}

export const BillingDrawerComponent: React.FC<BillingDrawerComponentProps> = ({
  isOpen,
  onClose,
  transition,
  enforcementEnabled,
  providerUnconfigured,
  subscriptionStatus,
  currentPlanSlug,
  currentIntervalKey,
  currentPeriodEndDisplay,
  usageRows,
  plans,
  compareInterval,
  onSelectCompareInterval,
  onCheckout,
  onManage,
  isActionLoading,
}) => {
  const { t } = useTranslation(['translation', 'billing']);

  const transitionKey = transition ? `billing:billing.transition.${transition}` : null;
  const planNameKey = currentPlanSlug ? `billing:billing.plans.${currentPlanSlug}.name` : null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('billing:billing.title')}
      subtitle={t('billing:billing.subtitle')}
      size="lg"
    >
      <BodyStack>
        {/* Transition / current state banner */}
        <SectionCard variant="bordered">
          {transitionKey ? (
            <Text variant="body-sm" weight="semibold">{t(transitionKey)}</Text>
          ) : null}
          <PlanHeaderRow>
            <PlanNameStack>
              {planNameKey ? (
                <Text variant="h3" weight="semibold">{t(planNameKey)}</Text>
              ) : (
                <Text variant="h3" weight="semibold">
                  {t('billing:billing.transition.no_subscription')}
                </Text>
              )}
              {currentIntervalKey ? (
                <Text variant="body-sm" muted>{t(currentIntervalKey)}</Text>
              ) : null}
              {currentPeriodEndDisplay ? (
                <Text variant="body-sm" muted>
                  {t('billing:billing.subscription.nextRenewal')}: {currentPeriodEndDisplay}
                </Text>
              ) : null}
            </PlanNameStack>
            {subscriptionStatus ? (
              <Badge variant={statusBadgeVariant(subscriptionStatus)} size="sm" isPill>
                {t(`billing:billing.subscription.status.${subscriptionStatus}`)}
              </Badge>
            ) : null}
          </PlanHeaderRow>
          <Button
            variant="secondary"
            size="medium"
            disabled={providerUnconfigured || !subscriptionStatus}
            isLoading={isActionLoading}
            onClick={onManage}
          >
            <Text variant="body-sm">{t('billing:billing.subscription.manage')}</Text>
          </Button>
        </SectionCard>

        {/* Provider unconfigured notice */}
        {providerUnconfigured ? (
          <SectionCard variant="bordered">
            <ProviderNotice>
              <Text variant="body-sm" weight="semibold">
                {t('billing:billing.provider.unconfiguredTitle')}
              </Text>
              <Text variant="caption" muted>
                {t('billing:billing.provider.unconfiguredBody')}
              </Text>
            </ProviderNotice>
          </SectionCard>
        ) : null}

        {/* Usage this period */}
        {usageRows.length > 0 ? (
          <SectionCard variant="bordered">
            <Text variant="body-sm" weight="semibold">{t('billing:billing.usage.title')}</Text>
            <UsageGrid>
              {usageRows.map((row) => (
                <UsageCellView key={row.labelKey} row={row} t={t} />
              ))}
            </UsageGrid>
            <Text variant="caption" muted>{t('billing:billing.usage.subtitle')}</Text>
          </SectionCard>
        ) : null}

        {/* Plan comparison */}
        {plans.length > 0 ? (
          <SectionCard variant="bordered">
            <CompareHeaderRow>
              <Text variant="body-sm" weight="semibold">{t('billing:billing.plans.title')}</Text>
              <SegmentedControl
                size="sm"
                value={compareInterval}
                onChange={(value) => onSelectCompareInterval(value as BillingInterval)}
                options={[
                  { label: t('billing:billing.plans.monthly'), value: BillingInterval.MONTHLY },
                  { label: t('billing:billing.plans.annual'), value: BillingInterval.ANNUAL },
                ]}
              />
            </CompareHeaderRow>
            <PricingGrid>
              {plans.map((plan) => (
                <PlanCardView
                  key={plan.planId}
                  plan={plan}
                  compareInterval={compareInterval}
                  providerUnconfigured={providerUnconfigured}
                  isActionLoading={isActionLoading}
                  onCheckout={onCheckout}
                  t={t}
                />
              ))}
            </PricingGrid>
            {!enforcementEnabled ? (
              <Text variant="caption" muted>{t('billing:billing.plans.informationalOnly')}</Text>
            ) : null}
          </SectionCard>
        ) : null}
      </BodyStack>
    </Drawer>
  );
};

BillingDrawerComponent.displayName = 'BillingDrawerComponent';
