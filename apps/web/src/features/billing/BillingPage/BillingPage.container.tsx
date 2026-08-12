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
  BillingProvider,
} from '@repo/shared';
import { formatCurrency, formatDate, getLocaleConfig, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetBillingCatalogQuery,
  useGetBillingSummaryQuery,
  useInitiateCheckoutMutation,
  useLazyOpenBillingPortalQuery,
} from '../api/billing.api';
import { formatBillingLimit, planLimitValue, usageBarValue, usageBarVariant, usedQtyForPeriod } from '../utils/usage';

import { BillingPageComponent } from './BillingPage.component';
import type { BillingPlanCard, BillingUsageRow } from './BillingPage.types';

import { getErrorI18nKey } from '@/utils/errorHandler';

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

  const [initiateCheckout, { isLoading: isCheckoutLoading }] = useInitiateCheckoutMutation();
  const [triggerPortal, { isFetching: isPortalFetching }] = useLazyOpenBillingPortalQuery();

  useLoading(isCheckoutLoading || isPortalFetching);

  const [compareInterval, setCompareInterval] = useState<BillingInterval>(BillingInterval.MONTHLY);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);

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
  const currentPeriodEndDisplay = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd, localeCfg.locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const usageRows: BillingUsageRow[] = useMemo(() => {
    if (!summary || !subscription || !summary.plan) {
      return [];
    }
    const plan = summary.plan;
    const periods = summary.usagePeriods;
    const unlimitedLabel = t('billing:billing.limits.unlimited');
    const disabledLabel = t('billing:billing.limits.disabled');

    const rows: BillingUsageRow[] = [];
    for (const key of [BillingLimitKey.LISTINGS_PER_MONTH, BillingLimitKey.AMAZON_ORDERS_PER_MONTH]) {
      const limit = planLimitValue({ plan }, key);
      const used = usedQtyForPeriod({ periods }, key);
      const labelKey = `billing:billing.limits.${key}.label`;
      const limitDisplay = formatBillingLimit({ limit, unlimitedLabel, disabledLabel, locale: localeCfg.locale });
      const usedDisplay = new Intl.NumberFormat(localeCfg.locale).format(used);
      const ofDisplay = t('billing:billing.limits.of', { used: usedDisplay, limit: limitDisplay });
      rows.push({
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
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: getErrorI18nKey(error),
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        t,
      );
    },
    [showMessage, closeMessage, t],
  );

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
    [providerUnconfigured, compareInterval, initiateCheckout, showMessage, closeMessage, t, surfaceBillingError],
  );

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
      currentPlanSlug={currentPlanSlug}
      currentIntervalKey={currentIntervalKey}
      currentPeriodEndDisplay={currentPeriodEndDisplay}
      usageRows={usageRows}
      plans={plans}
      compareInterval={compareInterval}
      checkoutPlanId={checkoutPlanId}
      isPortalLoading={isPortalFetching}
      onSelectCompareInterval={setCompareInterval}
      onCheckout={handleCheckout}
      onManage={handleManage}
    />
  );
};

BillingPage.displayName = 'BillingPage';
