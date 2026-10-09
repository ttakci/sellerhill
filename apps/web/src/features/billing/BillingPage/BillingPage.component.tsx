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
  Drawer,
  EmptyState,
  InfoMessage,
  Icon,
  PageHeader,
  SettingsCard,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { InvoiceHistoryCard } from '../components/InvoiceHistoryCard';
import { PlanChangeConfirm } from '../components/PlanChangeConfirm';

import * as S from './BillingPage.style';
import type {
  BillingFactTone,
  BillingPageComponentProps,
  BillingPlanCardViewProps,
  BillingUsageRow,
} from './BillingPage.types';

/**
 * Map a subscription status to a Badge variant. Pure, no hook deps.
 *
 * `cancelAtPeriodEnd` overrides an otherwise-'success' status to 'warning' —
 * `status` itself stays `active`/`trialing` in our tables right up until
 * Stripe's period actually ends (a Billing-Portal cancellation is read live
 * via `cancelAtPeriodEnd`, not written to our tables — see
 * `BillingDetailsDto.cancelAtPeriodEnd`), so without this override the badge
 * kept reading plain "Active" for a subscription already winding down, right
 * beside a meta line that said the opposite.
 */
function statusBadgeVariant(
  status: BillingSubscriptionStatus,
  cancelAtPeriodEnd: boolean,
): 'success' | 'warning' | 'neutral' {
  if (
    cancelAtPeriodEnd &&
    (status === BillingSubscriptionStatus.ACTIVE || status === BillingSubscriptionStatus.TRIALING)
  ) {
    return 'warning';
  }
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

/** A quota near or at its limit reads amber / red; a healthy one is brand blue. */
function usageTone(variant: BillingUsageRow['barVariant']): BillingFactTone {
  if (variant === 'error') {
    return 'negative';
  }
  if (variant === 'warning') {
    return 'warning';
  }
  return 'brand';
}

/** What is left reads green while there is room, amber / red as it runs out. */
function remainingTone(variant: BillingUsageRow['barVariant']): BillingFactTone {
  return variant === 'error' || variant === 'warning' ? usageTone(variant) : 'positive';
}

/** Render a single plan comparison card. */
function PlanCardView({
  plan,
  compareInterval,
  hasProviderSubscription,
  providerUnconfigured,
  checkoutPlanId,
  onCheckout,
}: BillingPlanCardViewProps): React.ReactElement {
  const { t } = useTranslation(['billing']);
  const periodKey =
    compareInterval === BillingInterval.MONTHLY ? 'billing:billing.plans.perMonth' : 'billing:billing.plans.perYear';
  const nameKey = `billing:billing.plans.${plan.slug}.name`;
  const descriptionKey = `billing:billing.plans.${plan.slug}.description`;
  // The label has to match what the click DOES. With a live Stripe
  // subscription the choice reprices it; without one it starts a new one.
  // Calling both "choose plan" hid that difference, and the difference is the
  // whole reason a second subscription — and a second bill — was possible.
  const ctaLabel = plan.isCurrent
    ? t('billing:billing.plans.currentPlan')
    : hasProviderSubscription
      ? t('billing:billing.plans.switchTo', { plan: t(nameKey) })
      : t('billing:billing.plans.choosePlan', { plan: t(nameKey) });
  const isCheckingOutThis = checkoutPlanId === plan.planId;
  const isCheckingOutOther = checkoutPlanId !== null && !isCheckingOutThis;

  return (
    <SettingsCard
      variant="section"
      header={{ title: t(nameKey), subtitle: t(descriptionKey) }}
      headerRight={
        // The price is the number a seller compares across 13 cards, so it
        // gets a colored badge instead of plain text — the same chip
        // treatment as the subscription status above, just for the figure
        // that matters most on THIS card.
        <Badge variant="primary" size="md" isPill>
          {plan.priceDisplay} {t(periodKey)}
        </Badge>
      }
    >
      <S.PlanFeatureList>
        {/* Leads the card (operator request, 2026-10-02): unlimited automatic
            orders and tracking is the promise a seller compares tools on. */}
        <S.PlanFeatureItem>
          <Text variant="body-sm" weight="semibold">
            {plan.amazonOrdersLine}
          </Text>
        </S.PlanFeatureItem>
        <S.PlanFeatureItem>
          <Text variant="body-sm">{plan.listingsLine}</Text>
        </S.PlanFeatureItem>
        {/* Conversions are the METERED, priced dimension the tier is sold on. */}
        <S.PlanFeatureItem>
          <Text variant="body-sm">
            {t('billing:billing.limits.tracking_conversions_per_month.label')}:{' '}
            {plan.trackingConversionsLimitDisplay}
          </Text>
        </S.PlanFeatureItem>
        <S.PlanFeatureItem>
          <Text variant="body-sm">
            {t('billing:billing.limits.best_sellers_products_per_month.label')}: {plan.bestSellersLimitDisplay}
          </Text>
        </S.PlanFeatureItem>
      </S.PlanFeatureList>
      <S.PlanCardFooter>
        <Button
          variant="primary"
          size="medium"
          fullWidth
          disabled={plan.isCurrent || providerUnconfigured || isCheckingOutOther}
          isLoading={isCheckingOutThis}
          onClick={() => onCheckout(plan.planId)}
        >
          <Icon name={plan.isCurrent ? 'check' : 'arrow-right'} size={16} />
          <Text variant="body-sm">{ctaLabel}</Text>
        </Button>
      </S.PlanCardFooter>
    </SettingsCard>
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
  cancelAtPeriodEnd,
  usageRows,
  plans,
  compareInterval,
  checkoutPlanId,
  isPortalLoading,
  onCheckout,
  onManage,
  hasProviderSubscription,
  planTitle,
  planDescription,
  summaryFacts,
  summaryHeadline,
  isPlansOpen,
  onOpenPlans,
  onClosePlans,
  addons,
  addonsSubtitle,
  addonSlugInFlight,
  onBuyAddon,
  cancelsAtPeriodEndLine,
  scheduledChangeLine,
  onCancelScheduledChange,
  isCancellingChange,
  paymentExpiringSoon,
  isPlanChangeOpen,
  planChangeBody,
  planChangeListingLimitWarning,
  isChangingPlan,
  onConfirmPlanChange,
  onCancelPlanChange,
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
            actionIcon="refresh"
            action={t('translation:common.retry')}
            onAction={onRetry}
          />
        </S.StateCard>
      </S.Container>
    );
  }

  /*
   * The notice under the summary is only for a state the seller has to act on
   * ("your payment failed", "no subscription", …). A healthy account shows
   * none — the actions live in the card's header row now, so the old neutral
   * "manage your billing here" box had nothing left to carry.
   */
  const noticeKey =
    transition && transition !== 'active' && transition !== 'full_access'
      ? `billing:billing.transition.${transition}`
      : null;

  /**
   * A past-due seller needs their CARD fixed, not a plan list: every gate is
   * closed for them and the notice says "update your payment method", so the
   * portal is the only action offered. Guarded on `hasProviderSubscription`
   * (the portal has nothing to show without a Stripe subscription) and on
   * `providerUnconfigured` (the call would 409).
   */
  const canOpenPortal = hasProviderSubscription && !providerUnconfigured;
  const needsPaymentFix = transition === 'past_due' && canOpenPortal;
  const isCancelling =
    cancelAtPeriodEnd &&
    (subscriptionStatus === BillingSubscriptionStatus.ACTIVE ||
      subscriptionStatus === BillingSubscriptionStatus.TRIALING);
  const hasNotices = Boolean(noticeKey || cancelsAtPeriodEndLine || paymentExpiringSoon || scheduledChangeLine);

  return (
    <S.Container>
      <PageHeader title={t('billing:billing.title')} subtitle={t('billing:billing.subtitle')} />

      {/*
        ONE hero for "what am I on, what is left, what do I pay next" — the
        listing detail page's hero: blue wash, the status badge top-left, the
        plan's name as the heading, fact rows, and one blue strip with the next
        charge and each quota. The saved card is a fact row, not a card.
      */}
      <S.Hero variant="elevated">
        {subscriptionStatus ? (
          <S.StatusBadgeSlot>
            <Badge variant={statusBadgeVariant(subscriptionStatus, cancelAtPeriodEnd)} size="sm" solid>
              {isCancelling
                ? t('billing:billing.subscription.status.cancelling')
                : t(`billing:billing.subscription.status.${subscriptionStatus}`)}
            </Badge>
          </S.StatusBadgeSlot>
        ) : null}

        <S.TitleRow>
          <S.PlanTitle variant="h2" weight="bold">
            {planTitle}
          </S.PlanTitle>
          {planDescription ? (
            <Text variant="body-sm" color="text.secondary">
              {planDescription}
            </Text>
          ) : null}
        </S.TitleRow>

        {summaryFacts.length > 0 ? (
          <S.FactList>
            {summaryFacts.map((fact) => (
              <S.FactItem key={fact.label}>
                <Text variant="body-sm" color="text.secondary">
                  {fact.label}
                </Text>
                <S.FactValue variant="body-sm" numeric $tone={fact.tone ?? 'default'}>
                  {fact.value}
                </S.FactValue>
              </S.FactItem>
            ))}
          </S.FactList>
        ) : null}

        {/* The page's actions sit inside the hero, on its right — the listing
            and order detail pattern. A past-due seller gets only the portal:
            they need their card fixed, not a plan list. */}
        <S.HeroActions>
          {canOpenPortal ? (
            <Button variant="navy" size="medium" isLoading={isPortalLoading} onClick={onManage}>
              <Icon name="wallet-cards" size={16} />
              <Text variant="body" weight="medium">
                {t('billing:billing.subscription.updatePayment')}
              </Text>
            </Button>
          ) : null}
          {needsPaymentFix ? null : (
            <Button variant="primary" size="medium" onClick={onOpenPlans}>
              <Icon name="layers" size={16} />
              <Text variant="body" weight="medium">
                {t('billing:billing.subscription.manage')}
              </Text>
            </Button>
          )}
        </S.HeroActions>

        {summaryHeadline || usageRows.length > 0 ? (
          <S.KpiStrip>
            {summaryHeadline ? (
              <S.KpiItem>
                <S.KpiLabel variant="body" color="text.secondary">
                  {summaryHeadline.label}
                </S.KpiLabel>
                <Text variant="metric-lg" weight="bold" numeric color="brand.primary">
                  {summaryHeadline.value}
                </Text>
                {summaryHeadline.caption ? (
                  <Text variant="body-sm" color="text.secondary" numeric>
                    {summaryHeadline.caption}
                  </Text>
                ) : null}
              </S.KpiItem>
            ) : null}
            {usageRows.map((row) => (
              <S.KpiItem key={row.labelKey}>
                <S.KpiLabel variant="body" color="text.secondary">
                  {t(row.labelKey)}
                </S.KpiLabel>
                {/* Used in colour, the ceiling muted, what is left in green
                    (amber / red as it runs out). */}
                <S.UsageFigure aria-label={row.barAriaLabel}>
                  <S.UsageUsed variant="metric" weight="bold" numeric $tone={usageTone(row.barVariant)}>
                    {row.usedDisplay}
                  </S.UsageUsed>
                  {row.isUnlimited ? null : (
                    <S.UsageLimit variant="body" color="text.secondary" numeric>
                      / {row.limitDisplay}
                    </S.UsageLimit>
                  )}
                </S.UsageFigure>
                {row.isUnlimited || row.remainingDisplay ? (
                  <S.FactValue
                    variant="body"
                    weight="semibold"
                    numeric
                    $tone={row.isUnlimited ? 'positive' : remainingTone(row.barVariant)}
                  >
                    {row.isUnlimited ? row.limitDisplay : row.remainingDisplay}
                  </S.FactValue>
                ) : null}
              </S.KpiItem>
            ))}
          </S.KpiStrip>
        ) : null}

        {hasNotices ? (
          <S.SummaryNotices>
            {scheduledChangeLine ? (
              <S.ScheduledChangeRow>
                <Text variant="body-sm">{scheduledChangeLine}</Text>
                <Button variant="primary" size="small" isLoading={isCancellingChange} onClick={onCancelScheduledChange}>
                  <Icon name="undo-2" size={16} />
                  <Text variant="body-sm">{t('billing:billing.subscription.cancelScheduledChange')}</Text>
                </Button>
              </S.ScheduledChangeRow>
            ) : null}
            {cancelsAtPeriodEndLine ? <InfoMessage>{cancelsAtPeriodEndLine}</InfoMessage> : null}
            {noticeKey ? <InfoMessage>{t(noticeKey)}</InfoMessage> : null}
            {paymentExpiringSoon ? <InfoMessage>{t('billing:billing.paymentMethod.expiringSoon')}</InfoMessage> : null}
          </S.SummaryNotices>
        ) : null}
      </S.Hero>

      {providerUnconfigured ? <InfoMessage>{t('billing:billing.provider.unconfiguredBody')}</InfoMessage> : null}

      <InvoiceHistoryCard />

      {addons.length > 0 ? (
        <SettingsCard
          variant="section"
          header={{
            title: t('billing:billing.addons.title'),
            subtitle: addonsSubtitle,
          }}
        >
          <S.AddonGrid>
            {addons.map((addon) => (
              <S.AddonCard key={addon.slug} variant="bordered" padding="lg">
                <S.AddonHeader>
                  <Text variant="h4" weight="semibold">
                    {addon.quantityDisplay}
                  </Text>
                  <Text variant="body" weight="semibold" numeric>
                    {addon.priceDisplay}
                  </Text>
                </S.AddonHeader>
                <S.AddonFooter>
                  <Button
                    variant="primary"
                    size="medium"
                    fullWidth
                    disabled={!addon.isPurchasable || providerUnconfigured}
                    isLoading={addonSlugInFlight === addon.slug}
                    onClick={() => onBuyAddon(addon.slug)}
                  >
                    <Icon name="shopping-cart" size={16} />
                    <Text variant="body-sm">{t('billing:billing.addons.buy')}</Text>
                  </Button>
                </S.AddonFooter>
              </S.AddonCard>
            ))}
          </S.AddonGrid>
          <Text variant="caption" color="text.secondary">
            {t('billing:billing.addons.note')}
          </Text>
        </SettingsCard>
      ) : null}

      {/*
        Plans live in a drawer, not on the page.
        Twelve tiers below the fold turned the billing screen into a price list
        whose main content — what you are on and what is left — was the small
        part at the top. The drawer opens from the one control on the plan card,
        so "manage my subscription" is a single place rather than a disabled
        button next to a wall of cards.
      */}
      <Drawer
        isOpen={isPlansOpen}
        onClose={onClosePlans}
        title={t('billing:billing.plans.title')}
        subtitle={t('billing:billing.plans.subtitle')}
      >
        <S.DrawerSection>
          {hasProviderSubscription ? (
            <>
              {/*
                Only offered with a real Stripe subscription: the portal has
                nothing to show a trial user, whose trial exists only in our
                own tables.
              */}
              <Button
                variant="primary"
                size="medium"
                fullWidth
                disabled={providerUnconfigured}
                isLoading={isPortalLoading}
                onClick={onManage}
              >
                <Icon name="external-link" size={16} />
                <Text variant="body-sm">{t('billing:billing.subscription.portal')}</Text>
              </Button>
              <Text variant="caption" color="text.secondary">
                {t('billing:billing.subscription.portalHint')}
              </Text>
            </>
          ) : null}

          {!enforcementEnabled ? (
            <Text variant="caption" color="text.secondary">
              {t('billing:billing.plans.informationalOnly')}
            </Text>
          ) : null}

          <S.DrawerPlanList>
            {plans.map((plan) => (
              <PlanCardView
                key={plan.planId}
                plan={plan}
                compareInterval={compareInterval}
                hasProviderSubscription={hasProviderSubscription}
                providerUnconfigured={providerUnconfigured}
                checkoutPlanId={checkoutPlanId}
                onCheckout={onCheckout}
              />
            ))}
          </S.DrawerPlanList>

        </S.DrawerSection>
      </Drawer>

      {/*
        A sibling of the Drawer, not nested inside it — the drawer may already
        be closed (checkoutPlanId's spinner runs on the plan card, which lives
        inside the drawer) by the time the preview comes back and this opens.
      */}
      <PlanChangeConfirm
        isOpen={isPlanChangeOpen}
        body={planChangeBody}
        listingLimitWarning={planChangeListingLimitWarning}
        isConfirming={isChangingPlan}
        onConfirm={onConfirmPlanChange}
        onCancel={onCancelPlanChange}
      />
    </S.Container>
  );
};

BillingPageComponent.displayName = 'BillingPageComponent';
