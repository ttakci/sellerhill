// apps/web/src/features/billing/BillingPage/BillingPage.container.tsx
//
// All logic for the standalone Billing page. Wires the billing RTK Query API
// (catalog + summary + checkout + portal), formats wire values into display
// strings for the component via the shared `utils/usage` helpers, and gates
// the upgrade/manage actions on provider configuration. 409 errors from
// checkout/portal are surfaced via MessageModal so the user is never left
// guessing why a click did nothing.
//
// The catalog + summary queries always render (the backend serves them even
// when no provider is configured — informational in that case). `useLoading`
// is reserved for the checkout/portal mutations only; the initial fetch uses
// the component's own EmptyState per the frontend loading rules.

import {
  BILLING_MICROS_PER_UNIT,
  BillingInterval,
  BillingLimitKey,
  BillingSubscriptionStatus,
  PlanChangeDirection,
  TRIAL_PLAN_SLUG,
  BillingProvider,
} from '@repo/shared';
import { formatCurrency, formatDate, formatMicroCurrency, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetBillingCatalogQuery,
  useGetBillingDetailsQuery,
  useGetBillingSummaryQuery,
  useCancelScheduledChangeMutation,
  useChangePlanMutation,
  useInitiateAddonCheckoutMutation,
  useInitiateCheckoutMutation,
  useLazyOpenBillingPortalQuery,
  usePreviewPlanChangeMutation,
} from '../api/billing.api';
import { formatBillingLimit, planLimitValue, usageBarValue, usageBarVariant } from '../utils/usage';

import { BillingPageComponent } from './BillingPage.component';
import type {
  BillingAddonCard,
  BillingPendingPlanChange,
  BillingPlanCard,
  BillingUsageRow,
} from './BillingPage.types';

import { getErrorI18nKey } from '@/utils/errorHandler';

/**
 * Every date on this page is money-adjacent (a charge, a cancellation, a plan
 * switch), so it must never be ambiguous about the year — `formatDate`'s own
 * default is day + month only. Shared so every call site here renders the
 * same shape as `currentPeriodEndDisplay` below.
 *
 * `timeZone: 'UTC'` is load-bearing, not cosmetic: every value passed through
 * this options object is a Stripe timestamp (`currentPeriodEnd`, `nextChargeAt`,
 * `cancelAt`, a schedule's `effectiveAt`), and Stripe's own hosted portal
 * renders the calendar date it assigned at creation, not the viewer's local
 * day. Without an explicit `timeZone`, `Intl.DateTimeFormat` falls back to the
 * browser's local timezone, so a Stripe event stamped close to UTC midnight
 * rolled onto the next (or previous) local day here while Stripe's own page
 * kept showing the UTC date — observed live for `InvoiceHistoryCard`'s
 * `issuedAt` column/card, which carries the identical fix for the same reason.
 */
const BILLING_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
};

/** Format a micros price into a display string. Free → the localized "Free" label. */
function formatPriceMicros(micros: number, currency: string, locale: string, freeLabel: string): string {
  if (micros === 0) {
    return freeLabel;
  }
  const major = micros / BILLING_MICROS_PER_UNIT;
  return formatCurrency(major, locale, currency, major % 1 === 0 ? 0 : 2);
}

export const BillingPage: React.FC = () => {
  const { t, i18n } = useTranslation(['translation', 'billing']);
  const { showMessage, closeMessage } = useUI();
  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const {
    data: catalog,
    isLoading: isCatalogLoading,
    refetch: refetchCatalog,
  } = useGetBillingCatalogQuery();
  const {
    data: summary,
    error: summaryError,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useGetBillingSummaryQuery();

  const { data: details } = useGetBillingDetailsQuery();
  const [cancelScheduledChange, { isLoading: isCancellingChange }] =
    useCancelScheduledChangeMutation();

  const [initiateCheckout, { isLoading: isCheckoutLoading }] = useInitiateCheckoutMutation();
  const [triggerPortal, { isFetching: isPortalFetching }] = useLazyOpenBillingPortalQuery();

  useLoading(isCheckoutLoading || isPortalFetching);

  // Monthly is the only interval the catalog carries (migration 083 retired the
  // annual prices), so this is a constant rather than state. Prices and the
  // checkout call are still keyed by interval, hence the value still exists.
  const compareInterval = BillingInterval.MONTHLY;
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);

  const [previewPlanChange] = usePreviewPlanChangeMutation();
  const [changePlan, { isLoading: isChangingPlan }] = useChangePlanMutation();
  /** The change the seller has previewed but not yet confirmed — see
   *  `BillingPendingPlanChange`. */
  const [pendingChange, setPendingChange] = useState<BillingPendingPlanChange | null>(null);

  const isInitialLoading = isCatalogLoading || isSummaryLoading;
  const isUnavailable = !isInitialLoading && !catalog;

  // Surface a transient summary fetch error via MessageModal (skip 401 — the
  // baseApi refresh layer handles it). A catalog failure is shown as the
  // page's own unavailable state instead, since the catalog is essential
  // content here rather than a secondary read.
  React.useEffect(() => {
    if (!summaryError) {
      return;
    }
    if ('status' in summaryError && summaryError.status === 401) {
      return;
    }
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(summaryError),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t,
    );
  }, [summaryError, showMessage, closeMessage, t]);

  const handleRetry = useCallback(() => {
    void refetchCatalog();
    void refetchSummary();
  }, [refetchCatalog, refetchSummary]);

  const providerUnconfigured = useMemo(() => {
    const provider = summary?.provider ?? catalog?.provider ?? BillingProvider.LOCAL;
    // Compare by string value — the DTO field and the enum literal are the same
    // BillingProvider, but the no-unsafe-enum-comparison lint rule is
    // conservative across the @repo/shared re-export boundary.
    return String(provider) === String(BillingProvider.LOCAL);
  }, [summary?.provider, catalog?.provider]);
  const enforcementEnabled = summary?.enforcementEnabled ?? catalog?.enforcementEnabled ?? false;

  const transition = summary?.transition ?? null;
  const subscription = summary?.subscription ?? null;
  const subscriptionStatus = subscription?.status ?? null;
  const currentPlanSlug = summary?.plan?.slug ?? null;
  const currentIntervalKey = subscription
    ? `billing:billing.subscription.intervalValue.${subscription.interval}`
    : null;
  const hasProviderSubscription = summary?.hasProviderSubscription ?? false;
  const [isPlansOpen, setIsPlansOpen] = useState(false);
  const currentPeriodEndDisplay = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd, localeCfg.locale, BILLING_DATE_OPTIONS)
    : null;

  const [initiateAddonCheckout] = useInitiateAddonCheckoutMutation();
  const [addonSlugInFlight, setAddonSlugInFlight] = useState<string | null>(null);

  /*
   * The single muted line under the plan name.
   *
   * Assembled here rather than in the component because WHAT belongs on it
   * depends on the kind of plan, and the old version got that wrong in two
   * visible ways for a free trial: it printed the billing interval (a trial is
   * not billed) and labelled the end date "next renewal" (a trial does not
   * renew — and this one had already ended, so it read as a future renewal for
   * something that was over).
   *
   * A paid plan keeps both parts; a trial gets only its end date, phrased for
   * whether it is still running or already finished.
   */
  const planMetaLine = useMemo(() => {
    if (!subscription) {
      return null;
    }
    const isTrial = currentPlanSlug === TRIAL_PLAN_SLUG;
    const parts: string[] = [];

    if (!isTrial && currentIntervalKey) {
      parts.push(t(currentIntervalKey));
    }
    if (currentPeriodEndDisplay) {
      const labelKey = isTrial
        ? subscriptionStatus === BillingSubscriptionStatus.TRIALING
          ? 'billing:billing.subscription.trialEnds'
          : 'billing:billing.subscription.trialEnded'
        : subscriptionStatus === BillingSubscriptionStatus.ACTIVE ||
            subscriptionStatus === BillingSubscriptionStatus.TRIALING
          ? 'billing:billing.subscription.nextRenewal'
          : 'billing:billing.subscription.accessEnds';
      parts.push(`${t(labelKey)}: ${currentPeriodEndDisplay}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }, [subscription, currentPlanSlug, currentIntervalKey, currentPeriodEndDisplay, subscriptionStatus, t]);

  // A trialing seller has no upcoming invoice; the existing trial-end meta line
  // stands in for this, so render nothing rather than an em dash beside a label.
  // A subscription set to cancel at period end also has no REAL next charge —
  // Stripe stops billing it — so that case is excluded here too, in favor of
  // cancelsAtPeriodEndLine below. Without this exclusion a cancelled
  // subscription still showed "Next payment: <date> · <amount>" for a charge
  // that was never going to happen.
  const nextChargeLine = useMemo(() => {
    if (
      typeof details?.nextChargeAmountMicros !== 'number' ||
      !details.nextChargeAt ||
      details.cancelAtPeriodEnd
    ) {
      return null;
    }
    return t('billing:billing.subscription.nextCharge', {
      date: formatDate(details.nextChargeAt, localeCfg.locale, BILLING_DATE_OPTIONS),
      amount: formatMicroCurrency(
        details.nextChargeAmountMicros,
        localeCfg.locale,
        details.nextChargeCurrency ?? 'USD',
      ),
    });
  }, [details, t, localeCfg.locale]);

  // Read live from Stripe on every load (see BillingDetailsDto.cancelAtPeriodEnd)
  // — a seller who cancelled via the Billing Portal wrote nothing to our
  // tables, so without this the plan card kept showing them as a normal
  // renewing subscriber (active badge, upcoming charge) right up until the
  // period actually ended.
  const cancelsAtPeriodEndLine = useMemo(() => {
    if (!details?.cancelAtPeriodEnd || !details.cancelAt) {
      return null;
    }
    return t('billing:billing.subscription.cancelsAtPeriodEnd', {
      date: formatDate(details.cancelAt, localeCfg.locale, BILLING_DATE_OPTIONS),
    });
  }, [details, t, localeCfg.locale]);

  const scheduledChangeLine = useMemo(() => {
    if (!details?.scheduledChange) {
      return null;
    }
    // planSlug is null when the backend could not resolve the schedule's
    // Stripe price back to one of our plans — the date and the Cancel action
    // are still real, only the name is unavailable, so this still renders a
    // line (with a different copy) rather than hiding the pending change.
    if (!details.scheduledChange.planSlug) {
      return t('billing:billing.subscription.scheduledChangeUnknownPlan', {
        date: formatDate(details.scheduledChange.effectiveAt, localeCfg.locale, BILLING_DATE_OPTIONS),
      });
    }
    return t('billing:billing.subscription.scheduledChange', {
      plan: t(`billing:billing.plans.${details.scheduledChange.planSlug}.name`),
      date: formatDate(details.scheduledChange.effectiveAt, localeCfg.locale, BILLING_DATE_OPTIONS),
    });
  }, [details, t, localeCfg.locale]);

  /*
   * The confirm dialog's body, fully assembled here rather than in
   * `PlanChangeConfirm` — `formatMicroCurrency`/`formatDate` are forbidden in
   * a `.component.tsx` file (see the plan-meta-line note above; same rule,
   * same reason), and this needs both.
   *
   * An upgrade takes money now; a downgrade takes none and lands at period
   * end, so the two read genuinely different sentences — telling a
   * downgrading seller they are "about to be charged" would describe a debit
   * that never happens.
   */
  const planChangeBody = useMemo(() => {
    if (!pendingChange) {
      return null;
    }
    const { preview, planSlug } = pendingChange;
    const planName = t(`billing:billing.plans.${planSlug}.name`);
    if (preview.direction === PlanChangeDirection.UPGRADE) {
      return t('billing:billing.planChange.upgradeBody', {
        plan: planName,
        amount: formatMicroCurrency(preview.amountDueMicros, localeCfg.locale, preview.currency),
        nextAmount:
          preview.nextInvoiceAmountMicros === null
            ? '—'
            : formatMicroCurrency(preview.nextInvoiceAmountMicros, localeCfg.locale, preview.currency),
        nextDate: preview.nextInvoiceAt
          ? formatDate(preview.nextInvoiceAt, localeCfg.locale, BILLING_DATE_OPTIONS)
          : '—',
      });
    }
    return t('billing:billing.planChange.downgradeBody', {
      plan: planName,
      date: formatDate(preview.effectiveAt, localeCfg.locale, BILLING_DATE_OPTIONS),
    });
  }, [pendingChange, t, localeCfg.locale]);

  const usageRows: BillingUsageRow[] = useMemo(() => {
    if (!summary || !subscription || !summary.plan) {
      return [];
    }
    const plan = summary.plan;
    const unlimitedLabel = t('billing:billing.limits.unlimited');
    const disabledLabel = t('billing:billing.limits.disabled');
    // `summary.quotas` is computed server-side from what actually exists.
    // `usagePeriods[].usedQty` — what this used to read — is a ledger column
    // nothing increments, so every bar sat at zero regardless of real usage.
    /*
     * BOTH figures come from `summary.quotas`, not half from the plan.
     *
     * `quotas[].limitValue` is the EFFECTIVE ceiling — plan allowance plus any
     * top-up bought this month — and it is the number the gate enforces.
     * Reading the limit from the plan instead showed a seller who had just
     * topped up their old ceiling, and showed nothing at all for a dimension
     * the catalog row happened not to carry.
     */
    const quotaByKey = new Map(summary.quotas.map((q) => [q.limitKey, q]));

    const rows: BillingUsageRow[] = [];
    for (const key of [
      BillingLimitKey.LISTINGS_PER_MONTH,
      BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
    ]) {
      const quota = quotaByKey.get(key);
      const limit = quota?.limitValue ?? planLimitValue({ plan }, key);
      const used = quota?.used ?? 0;
      const labelKey = `billing:billing.limits.${key}.label`;
      const limitDisplay = formatBillingLimit({ limit, unlimitedLabel, disabledLabel, locale: localeCfg.locale });
      const usedDisplay = new Intl.NumberFormat(localeCfg.locale).format(used);
      const ofDisplay = t('billing:billing.limits.of', { used: usedDisplay, limit: limitDisplay });
      /*
       * Percentage for inside the ring. `ofDisplay` ("50 / 50") stays as the
       * text beside it — rendering the used figure on its own AND inside
       * "used of limit" is what produced "50 50 / 50".
       */
      const ringLabel =
        limit > 0 ? `${Math.min(999, Math.round((used / limit) * 100))}%` : '—';
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
  }, [summary, subscription, t, localeCfg.locale]);

  const plans: BillingPlanCard[] = useMemo(() => {
    if (!catalog) {
      return [];
    }
    const unlimitedLabel = t('billing:billing.limits.unlimited');
    const disabledLabel = t('billing:billing.limits.disabled');
    const freeLabel = t('billing:billing.plans.free.name');
    return catalog.plans.map((plan) => {
      const price = plan.prices[compareInterval] ?? null;
      const priceDisplay = price
        ? formatPriceMicros(price.amountMicros, price.currency, localeCfg.locale, freeLabel)
        : '—';
      return {
        planId: plan.id,
        slug: plan.slug,
        priceDisplay,
        listingsLimitDisplay: formatBillingLimit({
          limit: planLimitValue({ plan }, BillingLimitKey.LISTINGS_PER_MONTH),
          unlimitedLabel,
          disabledLabel,
          locale: localeCfg.locale,
        }),
        trackingConversionsLimitDisplay: formatBillingLimit({
          limit: planLimitValue({ plan }, BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH),
          unlimitedLabel,
          disabledLabel,
          locale: localeCfg.locale,
        }),
        amazonOrdersLimitDisplay: formatBillingLimit({
          limit: planLimitValue({ plan }, BillingLimitKey.AMAZON_ORDERS_PER_MONTH),
          unlimitedLabel,
          disabledLabel,
          locale: localeCfg.locale,
        }),
        isCurrent: currentPlanSlug === plan.slug,
      };
    });
  }, [catalog, compareInterval, currentPlanSlug, t, localeCfg.locale]);

  // Surface a billing error (checkout 409, portal 409, etc.) via MessageModal.
  const surfaceBillingError = useCallback(
    (error: Parameters<typeof getErrorI18nKey>[0]) => {
      const key = getErrorI18nKey(error);
      // `getErrorI18nKey` already returns the fully namespaced key
      // (e.g. "billing:billing.errors.alreadySubscribed") — see errorHandler.ts.
      if (key === 'billing:billing.errors.alreadySubscribed') {
        // Our summary was stale — that staleness is what let one seller end up
        // with three subscriptions. Pull the truth again so the page stops
        // offering checkout; never auto-retry, which is what would create the
        // duplicate.
        void refetchSummary();
      }
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: key,
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        t,
      );
    },
    [refetchSummary, showMessage, closeMessage, t],
  );

  /**
   * Top-up packs, already formatted. The server only returns any when a meter
   * is actually exhausted — a credit is scoped to the current month, so
   * offering one to somebody with headroom left would sell them something they
   * cannot use.
   */
  const addons: BillingAddonCard[] = useMemo(() => {
    if (!summary || summary.quotaAddons.length === 0) {
      return [];
    }
    return summary.quotaAddons.map((addon) => ({
      slug: addon.slug,
      quantityDisplay: t(`billing:billing.limits.${addon.limitKey}.unit`, {
        count: addon.quantity,
        defaultValue: String(addon.quantity),
      }).replace(/^/, `${new Intl.NumberFormat(localeCfg.locale).format(addon.quantity)} `),
      priceDisplay: formatPriceMicros(
        addon.amountMicros,
        addon.currency,
        localeCfg.locale,
        ''
      ),
      isPurchasable: addon.isPurchasable,
    }));
  }, [summary, t, localeCfg.locale]);

  const handleBuyAddon = useCallback(
    (addonSlug: string) => {
      setAddonSlugInFlight(addonSlug);
      initiateAddonCheckout({ addonSlug })
        .unwrap()
        .then((result) => {
          if (result.checkoutUrl) {
            window.location.assign(result.checkoutUrl);
            return;
          }
          // Demo mode answers with an empty URL rather than a live payment
          // page; nothing to navigate to, so just stop the spinner.
          setAddonSlugInFlight(null);
        })
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
          setAddonSlugInFlight(null);
          surfaceBillingError(error);
        });
    },
    [initiateAddonCheckout, surfaceBillingError]
  );

  const handleCancelScheduledChange = useCallback(() => {
    void cancelScheduledChange()
      .unwrap()
      .then(() => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'billing:billing.subscription.scheduledChangeCancelled',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => surfaceBillingError(error));
  }, [cancelScheduledChange, showMessage, closeMessage, t, surfaceBillingError]);

  const handleOpenPlans = useCallback(() => setIsPlansOpen(true), []);
  const handleClosePlans = useCallback(() => setIsPlansOpen(false), []);

  const handleCheckout = useCallback(
    (planId: string) => {
      if (providerUnconfigured) {
        showMessage(
          {
            type: 'info',
            headerKey: 'billing:billing.provider.unconfiguredTitle',
            descriptionKey: 'billing:billing.provider.unconfiguredBody',
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
        return;
      }
      setCheckoutPlanId(planId);

      /*
       * Two genuinely different operations behind one click, and picking the
       * wrong one costs the customer money.
       *
       * With a live Stripe subscription the plan is repriced in place and
       * Stripe prorates. Opening checkout instead would create a SECOND
       * subscription — Stripe permits that without complaint, and both would
       * bill. With only a local trial (or nothing) there is nothing to reprice,
       * so checkout is correct.
       *
       * The reprice itself does not fire from here anymore. It previews
       * first — Stripe's own proration arithmetic, not an estimate — and
       * opens the confirm dialog; `handleConfirmPlanChange` is what actually
       * calls `changePlan`, against the exact plan/preview pair captured at
       * this moment (`planSlug` alongside `planId`, so the dialog's plan name
       * can never resolve to a different plan than the preview it shows).
       */
      if (hasProviderSubscription) {
        const planSlug = plans.find((plan) => plan.planId === planId)?.slug ?? '';
        void previewPlanChange({ planId, interval: compareInterval })
          .unwrap()
          .then((preview) => setPendingChange({ planId, planSlug, preview }))
          .catch((error: Parameters<typeof getErrorI18nKey>[0]) => surfaceBillingError(error))
          .finally(() => setCheckoutPlanId(null));
        return;
      }

      void initiateCheckout({ planId, interval: compareInterval })
        .unwrap()
        .then((result) => {
          if (result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
          }
        })
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
          surfaceBillingError(error);
        })
        .finally(() => setCheckoutPlanId(null));
    },
    [
      providerUnconfigured,
      compareInterval,
      hasProviderSubscription,
      plans,
      previewPlanChange,
      initiateCheckout,
      showMessage,
      closeMessage,
      t,
      surfaceBillingError,
    ],
  );

  const handleConfirmPlanChange = useCallback(() => {
    if (!pendingChange) {
      return;
    }
    void changePlan({ planId: pendingChange.planId, interval: compareInterval })
      .unwrap()
      .then(() => {
        setPendingChange(null);
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'billing:billing.plans.switchDone',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        // A declined card leaves the subscription UNCHANGED (the backend
        // uses error_if_incomplete) — the seller is still on their old plan,
        // so say why rather than closing silently.
        setPendingChange(null);
        surfaceBillingError(error);
      });
  }, [pendingChange, compareInterval, changePlan, showMessage, closeMessage, t, surfaceBillingError]);

  const handleCancelPlanChange = useCallback(() => setPendingChange(null), []);

  const handleManage = useCallback(() => {
    if (providerUnconfigured) {
      showMessage(
        {
          type: 'info',
          headerKey: 'billing:billing.provider.unconfiguredTitle',
          descriptionKey: 'billing:billing.provider.unconfiguredBody',
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        t,
      );
      return;
    }
    void triggerPortal()
      .unwrap()
      .then((result) => {
        if (result.portalUrl) {
          window.location.href = result.portalUrl;
        }
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        surfaceBillingError(error);
      });
  }, [providerUnconfigured, triggerPortal, showMessage, closeMessage, t, surfaceBillingError]);

  return (
    <BillingPageComponent
      isInitialLoading={isInitialLoading}
      isUnavailable={isUnavailable}
      onRetry={handleRetry}
      transition={transition}
      enforcementEnabled={enforcementEnabled}
      providerUnconfigured={providerUnconfigured}
      subscriptionStatus={subscriptionStatus}
      cancelAtPeriodEnd={Boolean(details?.cancelAtPeriodEnd)}
      currentPlanSlug={currentPlanSlug}
      usageRows={usageRows}
      plans={plans}
      compareInterval={compareInterval}
      checkoutPlanId={checkoutPlanId}
      isPortalLoading={isPortalFetching}
      onCheckout={handleCheckout}
      hasProviderSubscription={hasProviderSubscription}
      planMetaLine={planMetaLine}
      isPlansOpen={isPlansOpen}
      onOpenPlans={handleOpenPlans}
      onClosePlans={handleClosePlans}
      addons={addons}
      addonSlugInFlight={addonSlugInFlight}
      onBuyAddon={handleBuyAddon}
      onManage={handleManage}
      nextChargeLine={nextChargeLine}
      cancelsAtPeriodEndLine={cancelsAtPeriodEndLine}
      scheduledChangeLine={scheduledChangeLine}
      onCancelScheduledChange={handleCancelScheduledChange}
      isCancellingChange={isCancellingChange}
      paymentMethod={details?.paymentMethod ?? null}
      isPlanChangeOpen={Boolean(pendingChange)}
      planChangeBody={planChangeBody}
      isChangingPlan={isChangingPlan}
      onConfirmPlanChange={handleConfirmPlanChange}
      onCancelPlanChange={handleCancelPlanChange}
    />
  );
};

BillingPage.displayName = 'BillingPage';
