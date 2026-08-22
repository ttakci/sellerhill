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
  PageHeader,
  ProgressRing,
  SettingsCard,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { PaymentMethodCard } from '../components/PaymentMethodCard';

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
      {/*
        The ring carries the proportion and the percentage; the text beside it
        carries the actual figures. Previously the used value was rendered
        BOTH on its own and again inside "used of limit", so a full quota read
        "50 50 / 50".
      */}
      <ProgressRing
        value={row.barValue}
        variant={row.barVariant}
        size="sm"
        centerLabel={row.ringLabel}
        label={row.barAriaLabel}
      />
      <S.UsageTextStack>
        <Text variant="body-sm" weight="semibold">
          {t(row.labelKey)}
        </Text>
        <S.UsageValueRow>
          <Text variant="body" weight="semibold" numeric>
            {row.ofDisplay}
          </Text>
        </S.UsageValueRow>
      </S.UsageTextStack>
    </S.UsageCell>
  );
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
        // The price is the number a seller compares across 12 cards, so it
        // gets a colored badge instead of plain text — the same chip
        // treatment as the subscription status above, just for the figure
        // that matters most on THIS card.
        <Badge variant="primary" size="md" isPill>
          {plan.priceDisplay} {t(periodKey)}
        </Badge>
      }
    >
      <S.PlanFeatureList>
        <S.PlanFeatureItem>
          <Text variant="body-sm">
            {t('billing:billing.limits.listings_per_month.label')}: {plan.listingsLimitDisplay}
          </Text>
        </S.PlanFeatureItem>
        {/* Conversions sit second because they are the METERED, priced
            dimension — the automatic-order figure below is a ceiling, not what
            the tier is sold on. The card listed only listings and orders, so
            the thing the price is actually based on was invisible. */}
        <S.PlanFeatureItem>
          <Text variant="body-sm">
            {t('billing:billing.limits.tracking_conversions_per_month.label')}:{' '}
            {plan.trackingConversionsLimitDisplay}
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
  currentPlanSlug,
  usageRows,
  plans,
  compareInterval,
  checkoutPlanId,
  isPortalLoading,
  onCheckout,
  onManage,
  hasProviderSubscription,
  planMetaLine,
  isPlansOpen,
  onOpenPlans,
  onClosePlans,
  addons,
  addonSlugInFlight,
  onBuyAddon,
  nextChargeLine,
  scheduledChangeLine,
  onCancelScheduledChange,
  isCancellingChange,
  paymentMethod,
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

  /*
   * The notice box is always shown — it is where "manage billing" lives now,
   * not just where problems are announced.
   *
   * 'active' and 'full_access' carry a neutral hint instead of an alert: a
   * healthy account still needs a place to reach the plans drawer, and
   * rendering nothing there would leave that action with no home. Every other
   * transition carries its real, actionable copy ("your payment failed", …).
   */
  const noticeKey =
    transition && transition !== 'active' && transition !== 'full_access'
      ? `billing:billing.transition.${transition}`
      : 'billing:billing.subscription.manageHint';

  /**
   * A past-due seller needs their CARD fixed, not a plan list.
   *
   * Every gate is closed for them (`past_due` -> SUSPENDED), AppLayout has just
   * redirected them here, and the notice above literally says "update your
   * payment method" — but the one button next to it used to open the twelve-plan
   * drawer, with the Stripe portal link buried inside it as a secondary action.
   * That is the wrong content for this state (they do not want a different plan)
   * and the label did not describe what the button did. Send them straight to
   * the portal instead, which is the only place a card can be changed.
   *
   * Guarded on `hasProviderSubscription` because the portal has nothing to show
   * without a Stripe subscription, and on `providerUnconfigured` because the
   * call would 409 — in both cases the plans drawer is still the right home for
   * the action. Every other transition keeps the drawer: `no_subscription` and
   * `canceled` need a plan chosen, not a card updated.
   */
  const needsPaymentFix =
    transition === 'past_due' && hasProviderSubscription && !providerUnconfigured;
  const planNameKey = currentPlanSlug ? `billing:billing.plans.${currentPlanSlug}.name` : null;

  return (
    <S.Container>
      <PageHeader title={t('billing:billing.title')} subtitle={t('billing:billing.subtitle')} />

      {/*
        ONE card for "what am I on and how much is left", not two.
        Splitting the plan identity from its usage put the answer to a single
        question across two cards, and the identity half was a vertical stack of
        four short strings with no hierarchy. Trial and paid look identical here
        on purpose — a trial IS the current plan, and showing it anywhere else
        would make a trialling seller look like they had none.
      */}
      <S.SubscriptionCard
        variant="section"
        header={{ title: t('billing:billing.subscription.title') }}
        headerRight={
          // Top-right of the CARD, in the header row next to the title — not
          // beside the plan name, which put it in the middle of a text stack
          // instead of the corner a status badge conventionally occupies (see
          // the listing-detail hero card's own StatusBadgeSlot).
          subscriptionStatus ? (
            <Badge variant={statusBadgeVariant(subscriptionStatus)} size="sm" isPill>
              {t(`billing:billing.subscription.status.${subscriptionStatus}`)}
            </Badge>
          ) : undefined
        }
      >
        <S.PlanHeaderRow>
          <S.PlanNameStack>
            <Text variant="h3" weight="semibold">
              {planNameKey ? t(planNameKey) : t('billing:billing.transition.no_subscription')}
            </Text>
            {planMetaLine ? (
              <S.PlanMetaRow>
                {/*
                  One muted line, assembled in the container because what
                  belongs on it depends on the kind of plan. A trial has no
                  billing interval and does not renew — it used to read
                  "Monthly billing · Next renewal" for an expired free trial,
                  which was wrong on both counts.
                */}
                <Text variant="body-sm" color="text.secondary">
                  {planMetaLine}
                </Text>
              </S.PlanMetaRow>
            ) : null}
            {nextChargeLine ? (
              <Text variant="body-sm" color="text.secondary" numeric>
                {nextChargeLine}
              </Text>
            ) : null}
          </S.PlanNameStack>
        </S.PlanHeaderRow>

        {scheduledChangeLine ? (
          <S.ScheduledChangeRow>
            <Text variant="body-sm">{scheduledChangeLine}</Text>
            <Button
              variant="secondary"
              size="small"
              isLoading={isCancellingChange}
              onClick={onCancelScheduledChange}
            >
              <Text variant="body-sm">
                {t('billing:billing.subscription.cancelScheduledChange')}
              </Text>
            </Button>
          </S.ScheduledChangeRow>
        ) : null}

        {usageRows.length > 0 ? (
          <S.UsageSection>
            <S.PlanDivider />
            <Text variant="body-sm" weight="semibold">
              {t('billing:billing.usage.title')}
            </Text>
            {/* Three across on desktop, reflowing down on a narrow screen —
                the three meters are the same kind of thing and read as one
                row rather than a list of unrelated facts. */}
            <S.UsageGrid>
              {usageRows.map((row) => (
                <UsageCellView key={row.labelKey} row={row} />
              ))}
            </S.UsageGrid>
          </S.UsageSection>
        ) : null}

        <S.NoticeRow>
          {/*
            ONE box, always shown, full width — it carries both the message
            AND the action now, rather than a separate button row plus a notice
            that only sometimes appeared. Its width matches the usage grid
            above it (S.NoticeRow stretches its child to 100%), so the row
            reads as the close of the same card, not a narrower, disconnected
            element. For a healthy subscription the copy is a neutral "manage
            your billing here" hint — the action still needs a home even when
            nothing is wrong.
          */}
          <InfoMessage
            action={
              needsPaymentFix
                ? t('billing:billing.subscription.updatePayment')
                : t('billing:billing.subscription.manage')
            }
            onAction={needsPaymentFix ? onManage : onOpenPlans}
            isActionLoading={needsPaymentFix ? isPortalLoading : false}
          >
            {t(noticeKey)}
          </InfoMessage>
        </S.NoticeRow>
      </S.SubscriptionCard>

      {paymentMethod ? (
        <PaymentMethodCard
          paymentMethod={paymentMethod}
          onChange={onManage}
          isChangeLoading={isPortalLoading}
        />
      ) : null}

      {providerUnconfigured ? <InfoMessage>{t('billing:billing.provider.unconfiguredBody')}</InfoMessage> : null}

      {addons.length > 0 ? (
        <SettingsCard
          variant="section"
          header={{
            title: t('billing:billing.addons.title'),
            subtitle: t('billing:billing.addons.subtitle'),
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
                    variant="secondary"
                    size="medium"
                    fullWidth
                    disabled={!addon.isPurchasable || providerUnconfigured}
                    isLoading={addonSlugInFlight === addon.slug}
                    onClick={() => onBuyAddon(addon.slug)}
                  >
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
                variant="secondary"
                size="medium"
                fullWidth
                disabled={providerUnconfigured}
                isLoading={isPortalLoading}
                onClick={onManage}
              >
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
    </S.Container>
  );
};

BillingPageComponent.displayName = 'BillingPageComponent';
