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
  BILLING_UNLIMITED,
  BillingInterval,
  BillingLimitKey,
  BillingSubscriptionStatus,
  PlanChangeDirection,
  TRIAL_PLAN_SLUG,
  BillingProvider,
} from '@repo/shared';
import { formatCurrency, formatDate, formatMicroCurrency, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

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
  useConfirmCheckoutMutation,
} from '../api/billing.api';
import { formatBillingLimit, planLimitValue } from '../utils/usage';
import { buildBillingUsageRows } from '../utils/usageRows';

import { BillingPageComponent } from './BillingPage.component';
import type {
  BillingAddonCard,
  BillingPendingPlanChange,
  BillingPlanCard,
  BillingSummaryFact,
  BillingSummaryHeadline,
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

  /*
   * Checkout return: Stripe sends the seller back to
   * `/billing?checkout=success&session_id=cs_...`. Confirm that session with
   * the backend straight away, so the new subscription is recorded now instead
   * of whenever (or whether) its webhook arrives. Runs once per session id;
   * the query params are removed afterwards so a reload does not repeat it.
   * Failures are silent on purpose — the webhook and the hourly reconcile are
   * still coming, and a paying seller must not see an error for a payment that
   * succeeded.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmCheckout] = useConfirmCheckoutMutation();
  const confirmedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (searchParams.get('checkout') !== 'success' || !sessionId) {
      return;
    }
    if (confirmedSessionRef.current === sessionId) {
      return;
    }
    confirmedSessionRef.current = sessionId;
    void confirmCheckout({ sessionId })
      .unwrap()
      .catch(() => undefined)
      .finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('checkout');
        next.delete('session_id');
        setSearchParams(next, { replace: true });
      });
  }, [searchParams, setSearchParams, confirmCheckout]);
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

  const isTrialPlan = currentPlanSlug === TRIAL_PLAN_SLUG;

  /*
   * The headline figure on the right of the summary card — the one number the
   * seller looks for first, the way the job page shows its progress. A paid
   * plan shows its next charge; a cancelling one the day access ends; a trial
   * the day it ends. Whatever date the headline carries is left out of the
   * fact list beside it, so the same date is never printed twice.
   */
  const summaryHeadline: BillingSummaryHeadline | null = useMemo(() => {
    if (details?.cancelAtPeriodEnd && details.cancelAt) {
      return {
        label: t('billing:billing.subscription.accessEnds'),
        value: formatDate(details.cancelAt, localeCfg.locale, BILLING_DATE_OPTIONS),
        caption: null,
      };
    }
    if (typeof details?.nextChargeAmountMicros === 'number' && details.nextChargeAt) {
      return {
        label: t('billing:billing.subscription.nextChargeLabel'),
        value: formatMicroCurrency(
          details.nextChargeAmountMicros,
          localeCfg.locale,
          details.nextChargeCurrency ?? 'USD',
        ),
        caption: formatDate(details.nextChargeAt, localeCfg.locale, BILLING_DATE_OPTIONS),
      };
    }
    if (isTrialPlan && currentPeriodEndDisplay) {
      return {
        label: t(
          subscriptionStatus === BillingSubscriptionStatus.TRIALING
            ? 'billing:billing.subscription.trialEnds'
            : 'billing:billing.subscription.trialEnded',
        ),
        value: currentPeriodEndDisplay,
        caption: null,
      };
    }
    return null;
  }, [details, isTrialPlan, currentPeriodEndDisplay, subscriptionStatus, t, localeCfg.locale]);

  /** The hero's heading — the plan's name, the way the listing hero leads with the product. */
  const planTitle = currentPlanSlug
    ? t(`billing:billing.plans.${currentPlanSlug}.name`)
    : t('billing:billing.transition.no_subscription');
  const planDescription = currentPlanSlug ? t(`billing:billing.plans.${currentPlanSlug}.description`) : null;

  /*
   * The fact rows under the plan name. A trial is not billed and does not
   * renew, so it gets neither an interval nor a "next renewal" row — the old
   * one-line version printed both for an expired free trial.
   */
  const summaryFacts: BillingSummaryFact[] = useMemo(() => {
    const facts: BillingSummaryFact[] = [];
    if (!subscription) {
      return facts;
    }
    if (!isTrialPlan && currentIntervalKey) {
      facts.push({ label: t('billing:billing.subscription.interval'), value: t(currentIntervalKey) });
    }
    // The headline already carries the next charge's date (or the day access
    // ends); a renewal row beside it would repeat it.
    if (currentPeriodEndDisplay && !summaryHeadline) {
      const labelKey =
        subscriptionStatus === BillingSubscriptionStatus.ACTIVE ||
        subscriptionStatus === BillingSubscriptionStatus.TRIALING
          ? 'billing:billing.subscription.nextRenewal'
          : 'billing:billing.subscription.accessEnds';
      facts.push({ label: t(labelKey), value: currentPeriodEndDisplay });
    }
    const card = details?.paymentMethod;
    if (card) {
      facts.push({
        label: t('billing:billing.paymentMethod.title'),
        value: `${t('billing:billing.paymentMethod.card', {
          brand: card.brand.toUpperCase(),
          last4: card.last4,
        })} · ${String(card.expMonth).padStart(2, '0')}/${card.expYear}`,
        tone: card.expiringSoon ? 'warning' : 'default',
      });
    }
    return facts;
  }, [
    subscription,
    isTrialPlan,
    currentIntervalKey,
    currentPeriodEndDisplay,
    summaryHeadline,
    subscriptionStatus,
    details?.paymentMethod,
    t,
  ]);

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

  /*
   * Downgrade-only warning: the seller holds more active listings than the new
   * plan allows. Nothing is ended for them — from the effective date only the
   * oldest listings up to the new limit keep price/stock sync and automated
   * orders — so they are told the number and the date while they can still
   * choose which listings to keep.
   *
   * "Active" is read from `summary.quotas`, the same figure the quota gate
   * refuses on, so the warning cannot disagree with what the backend counts.
   */
  const planChangeListingLimitWarning = useMemo(() => {
    if (!pendingChange || pendingChange.preview.direction !== PlanChangeDirection.DOWNGRADE) {
      return null;
    }
    const targetPlan = catalog?.plans.find((plan) => plan.id === pendingChange.planId);
    // Read directly, not via `planLimitValue`: that helper maps a missing limit
    // to 0, which here would warn that every listing is over a limit that does
    // not exist.
    const newLimit = targetPlan?.limits[BillingLimitKey.LISTINGS_PER_MONTH]?.limitValue ?? null;
    const activeListings =
      summary?.quotas.find((quota) => quota.limitKey === BillingLimitKey.LISTINGS_PER_MONTH)?.used ?? null;
    if (newLimit === null || newLimit === -1 || activeListings === null || activeListings <= newLimit) {
      return null;
    }
    const numberFormat = new Intl.NumberFormat(localeCfg.locale);
    return t('billing:billing.planChange.listingLimitWarning', {
      date: formatDate(pendingChange.preview.effectiveAt, localeCfg.locale, BILLING_DATE_OPTIONS),
      active: numberFormat.format(activeListings),
      limit: numberFormat.format(newLimit),
      over: numberFormat.format(activeListings - newLimit),
    });
  }, [pendingChange, catalog, summary, t, localeCfg.locale]);

  // Assembled by the shared builder so this list and the identical one in the
  // top-right profile dropdown can never drift. `summary.quotas` is computed
  // server-side from what actually exists — `usagePeriods[].usedQty` (what this
  // used to read) is a ledger column nothing increments, so every bar sat at
  // zero regardless of real usage.
  const usageRows: BillingUsageRow[] = useMemo(
    () => buildBillingUsageRows(summary, t, localeCfg.locale),
    [summary, t, localeCfg.locale],
  );

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
      const listingsLimit = planLimitValue({ plan }, BillingLimitKey.LISTINGS_PER_MONTH);
      const listingsLimitDisplay = formatBillingLimit({
        limit: listingsLimit,
        unlimitedLabel,
        disabledLabel,
        locale: localeCfg.locale,
      });
      const amazonOrdersLimit = planLimitValue({ plan }, BillingLimitKey.AMAZON_ORDERS_PER_MONTH);
      return {
        planId: plan.id,
        slug: plan.slug,
        priceDisplay,
        // -1 on every plan since 2026-09-29. A finite value (the key is kept so
        // the limit can be re-tightened) falls back to the plain "label: N".
        amazonOrdersLine:
          amazonOrdersLimit === BILLING_UNLIMITED
            ? t('billing:billing.plans.unlimitedOrders')
            : `${t('billing:billing.limits.amazon_orders_per_month.label')}: ${formatBillingLimit({
                limit: amazonOrdersLimit,
                unlimitedLabel,
                disabledLabel,
                locale: localeCfg.locale,
              })}`,
        listingsLine:
          listingsLimit > 0
            ? t('billing:billing.plans.activeListings', { limit: listingsLimitDisplay })
            : `${t('billing:billing.limits.listings_per_month.label')}: ${listingsLimitDisplay}`,
        trackingConversionsLimitDisplay: formatBillingLimit({
          limit: planLimitValue({ plan }, BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH),
          unlimitedLabel,
          disabledLabel,
          locale: localeCfg.locale,
        }),
        bestSellersLimitDisplay: formatBillingLimit({
          limit: planLimitValue({ plan }, BillingLimitKey.BEST_SELLERS_PRODUCTS_PER_MONTH),
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

  /**
   * One sentence per dimension the offered packs raise, in the order the
   * packs arrive. The generic line is the fallback for a limit key that has
   * no dedicated sentence yet, so a new pack type never renders a raw key.
   */
  const addonsSubtitle = useMemo<string>(() => {
    const limitKeys = Array.from(new Set((summary?.quotaAddons ?? []).map((addon) => addon.limitKey)));
    const sentences = limitKeys
      .map((limitKey) => t(`billing:billing.addons.subtitleByLimit.${limitKey}`, { defaultValue: '' }))
      .filter((sentence) => sentence.length > 0);
    return sentences.length > 0 ? sentences.join(' ') : t('billing:billing.addons.subtitle');
  }, [summary?.quotaAddons, t]);

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
    // A one-click, no-confirm cancel here read as an accident waiting to
    // happen — the button undoes a plan change the seller just chose, so it
    // deserves the same "are you sure" step every other reversible-but-not-
    // trivial action in this app gets (delete a template, delete a group).
    showMessage(
      {
        type: 'warning',
        headerKey: 'billing:billing.subscription.confirmCancelScheduledChangeTitle',
        descriptionKey: 'billing:billing.subscription.confirmCancelScheduledChangeMessage',
        primaryButton: {
          labelKey: 'billing:billing.subscription.cancelScheduledChange',
          onClick: () => {
            closeMessage();
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
          },
        },
        secondaryButton: {
          labelKey: 'translation:common.cancel',
          onClick: closeMessage,
        },
      },
      t,
    );
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
      usageRows={usageRows}
      plans={plans}
      compareInterval={compareInterval}
      checkoutPlanId={checkoutPlanId}
      isPortalLoading={isPortalFetching}
      onCheckout={handleCheckout}
      hasProviderSubscription={hasProviderSubscription}
      summaryFacts={summaryFacts}
      summaryHeadline={summaryHeadline}
      planTitle={planTitle}
      planDescription={planDescription}
      isPlansOpen={isPlansOpen}
      onOpenPlans={handleOpenPlans}
      onClosePlans={handleClosePlans}
      addons={addons}
      addonsSubtitle={addonsSubtitle}
      addonSlugInFlight={addonSlugInFlight}
      onBuyAddon={handleBuyAddon}
      onManage={handleManage}
      cancelsAtPeriodEndLine={cancelsAtPeriodEndLine}
      scheduledChangeLine={scheduledChangeLine}
      onCancelScheduledChange={handleCancelScheduledChange}
      isCancellingChange={isCancellingChange}
      paymentExpiringSoon={Boolean(details?.paymentMethod?.expiringSoon)}
      isPlanChangeOpen={Boolean(pendingChange)}
      planChangeBody={planChangeBody}
      planChangeListingLimitWarning={planChangeListingLimitWarning}
      isChangingPlan={isChangingPlan}
      onConfirmPlanChange={handleConfirmPlanChange}
      onCancelPlanChange={handleCancelPlanChange}
    />
  );
};

BillingPage.displayName = 'BillingPage';
