// apps/web/src/features/billing/BillingPage/BillingPage.component.tsx
//
// Presentation-only. Allowed hooks: useTranslation. No RTK Query, no
// useState/useEffect, no formatters (Intl.NumberFormat / formatCurrency) — the
// container pre-formats every value into display strings. The only logic here
// is the subscription-status → badge-variant map (pure, module-scope, no hook).

import { BillingInterval, BillingSubscriptionStatus } from '@repo/shared';
import {
  Badge,
  Button,
  EmptyState,
  InfoMessage,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  SettingsCard,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './BillingPage.style';
import type {
  BillingPageComponentProps,
  BillingPlanCardViewProps,
  BillingUsageCellViewProps,
} from './BillingPage.types';

/** Map a subscription status to a Badge variant. Pure, no hook deps. */
function statusBadgeVariant(status: BillingSubscriptionStatus): 'success' | 'warning' | 'neutral' {
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
function UsageCellView({ row }: BillingUsageCellViewProps): React.ReactElement {
  const { t } = useTranslation(['billing']);
  return (
    <S.UsageCell>
      <Text variant="body-sm" weight="semibold">
        {t(row.labelKey)}
      </Text>
      <S.UsageValueRow>
        <Text variant="h4" weight="semibold">
          {row.usedDisplay}
        </Text>
        <Text variant="body-sm" color="text.secondary">
          {row.ofDisplay}
        </Text>
      </S.UsageValueRow>
      <ProgressBar value={row.barValue} variant={row.barVariant} size="sm" label={row.barAriaLabel} />
    </S.UsageCell>
  );
}

/** Render a single plan comparison card. */
function PlanCardView({
  plan,
  compareInterval,
  providerUnconfigured,
  checkoutPlanId,
  onCheckout,
}: BillingPlanCardViewProps): React.ReactElement {
  const { t } = useTranslation(['billing']);
  const periodKey =
    compareInterval === BillingInterval.MONTHLY ? 'billing:billing.plans.perMonth' : 'billing:billing.plans.perYear';
  const nameKey = `billing:billing.plans.${plan.slug}.name`;
  const descriptionKey = `billing:billing.plans.${plan.slug}.description`;
  const ctaLabel = plan.isCurrent
    ? t('billing:billing.plans.currentPlan')
    : t('billing:billing.plans.choosePlan', { plan: t(nameKey) });
  const isCheckingOutThis = checkoutPlanId === plan.planId;
  const isCheckingOutOther = checkoutPlanId !== null && !isCheckingOutThis;

  return (
    <S.PlanCard variant="bordered" padding="lg">
      <S.PlanCardHeader>
        <Text variant="h4" weight="semibold">
          {t(nameKey)}
        </Text>
        <Text variant="body-sm" color="text.secondary">
          {t(descriptionKey)}
        </Text>
      </S.PlanCardHeader>
      <S.PlanPriceRow>
        <Text variant="h3" weight="semibold">
          {plan.priceDisplay}
        </Text>
        <Text variant="body-sm" color="text.secondary">
          {t(periodKey)}
        </Text>
      </S.PlanPriceRow>
      <S.PlanFeatureList>
        <S.PlanFeatureItem>
          <Text variant="body-sm">
            {t('billing:billing.limits.listings_per_month.label')}: {plan.listingsLimitDisplay}
          </Text>
        </S.PlanFeatureItem>
        <S.PlanFeatureItem>
          <Text variant="body-sm">
            {t('billing:billing.limits.amazon_orders_per_month.label')}: {plan.amazonOrdersLimitDisplay}
          </Text>
        </S.PlanFeatureItem>
      </S.PlanFeatureList>
      <S.PlanCardFooter>
        <Button
          variant={plan.isCurrent ? 'secondary' : 'primary'}
          size="medium"
          fullWidth
          disabled={plan.isCurrent || providerUnconfigured || isCheckingOutOther}
          isLoading={isCheckingOutThis}
          onClick={() => onCheckout(plan.planId)}
        >
          <Text variant="body-sm">{ctaLabel}</Text>
        </Button>
      </S.PlanCardFooter>
    </S.PlanCard>
  );
}

export const BillingPageComponent: React.FC<BillingPageComponentProps> = ({
  isInitialLoading,
  isUnavailable,
  onRetry,
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
  checkoutPlanId,
  isPortalLoading,
  onSelectCompareInterval,
  onCheckout,
  onManage,
}) => {
  const { t } = useTranslation(['translation', 'billing']);

  if (isInitialLoading) {
    return (
      <S.Container>
        <PageHeader title={t('billing:billing.title')} subtitle={t('billing:billing.subtitle')} />
        <S.StateCard variant="elevated" padding="lg">
          <EmptyState
            icon="receipt-text"
            title={t('translation:common.loading')}
            description={t('billing:billing.loadingSubtitle')}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  if (isUnavailable) {
    return (
      <S.Container>
        <PageHeader title={t('billing:billing.title')} subtitle={t('billing:billing.subtitle')} />
        <S.StateCard variant="elevated" padding="lg">
          <EmptyState
            icon="receipt-text"
            title={t('billing:billing.unavailableTitle')}
            description={t('billing:billing.unavailableSubtitle')}
            action={t('translation:common.retry')}
            onAction={onRetry}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  const transitionKey = transition ? `billing:billing.transition.${transition}` : null;
  const planNameKey = currentPlanSlug ? `billing:billing.plans.${currentPlanSlug}.name` : null;

  return (
    <S.Container>
      <PageHeader title={t('billing:billing.title')} subtitle={t('billing:billing.subtitle')} />

      <SettingsCard variant="section" header={{ title: t('billing:billing.subscription.title') }}>
        {transitionKey ? (
          <Text variant="body-sm" weight="semibold">
            {t(transitionKey)}
          </Text>
        ) : null}
        <S.PlanHeaderRow>
          <S.PlanNameStack>
            {planNameKey ? (
              <Text variant="h3" weight="semibold">
                {t(planNameKey)}
              </Text>
            ) : (
              <Text variant="h3" weight="semibold">
                {t('billing:billing.transition.no_subscription')}
              </Text>
            )}
            {currentIntervalKey ? (
              <Text variant="body-sm" color="text.secondary">
                {t(currentIntervalKey)}
              </Text>
            ) : null}
            {currentPeriodEndDisplay ? (
              <Text variant="body-sm" color="text.secondary">
                {t('billing:billing.subscription.nextRenewal')}: {currentPeriodEndDisplay}
              </Text>
            ) : null}
          </S.PlanNameStack>
          {subscriptionStatus ? (
            <Badge variant={statusBadgeVariant(subscriptionStatus)} size="sm" isPill>
              {t(`billing:billing.subscription.status.${subscriptionStatus}`)}
            </Badge>
          ) : null}
        </S.PlanHeaderRow>
        <S.ManageButtonRow>
          <Button
            variant="secondary"
            size="medium"
            disabled={providerUnconfigured || !subscriptionStatus}
            isLoading={isPortalLoading}
            onClick={onManage}
          >
            <Text variant="body-sm">{t('billing:billing.subscription.manage')}</Text>
          </Button>
        </S.ManageButtonRow>
      </SettingsCard>

      {providerUnconfigured ? <InfoMessage>{t('billing:billing.provider.unconfiguredBody')}</InfoMessage> : null}

      {usageRows.length > 0 ? (
        <SettingsCard
          variant="section"
          header={{ title: t('billing:billing.usage.title'), subtitle: t('billing:billing.usage.subtitle') }}
        >
          <S.UsageGrid>
            {usageRows.map((row) => (
              <UsageCellView key={row.labelKey} row={row} />
            ))}
          </S.UsageGrid>
        </SettingsCard>
      ) : null}

      {plans.length > 0 ? (
        <SettingsCard
          variant="section"
          header={{ title: t('billing:billing.plans.title'), subtitle: t('billing:billing.plans.subtitle') }}
          headerRight={
            <S.CompareControlSlot>
              <SegmentedControl
                size="sm"
                value={compareInterval}
                onChange={(value) => onSelectCompareInterval(value as BillingInterval)}
                options={[
                  { label: t('billing:billing.plans.monthly'), value: BillingInterval.MONTHLY },
                  { label: t('billing:billing.plans.annual'), value: BillingInterval.ANNUAL },
                ]}
              />
            </S.CompareControlSlot>
          }
        >
          <S.PricingGrid>
            {plans.map((plan) => (
              <PlanCardView
                key={plan.planId}
                plan={plan}
                compareInterval={compareInterval}
                providerUnconfigured={providerUnconfigured}
                checkoutPlanId={checkoutPlanId}
                onCheckout={onCheckout}
              />
            ))}
          </S.PricingGrid>
          {!enforcementEnabled ? (
            <Text variant="caption" color="text.secondary">
              {t('billing:billing.plans.informationalOnly')}
            </Text>
          ) : null}
        </SettingsCard>
      ) : null}
    </S.Container>
  );
};

BillingPageComponent.displayName = 'BillingPageComponent';
