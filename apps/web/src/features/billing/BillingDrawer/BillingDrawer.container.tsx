// apps/web/src/features/billing/BillingDrawer/BillingDrawer.container.tsx
//
// All logic for the BillingDrawer. Wires the billing RTK Query API
// (catalog + summary + checkout + portal), formats wire values into display
// strings for the component, and gates the upgrade/manage actions on provider
// configuration. 409 errors from checkout/portal are surfaced via MessageModal
// so the user is never left guessing why a click did nothing.
//
// Formatters (formatCurrency / formatDate / Intl.NumberFormat) live HERE per
// the frontend-rules — the component receives only pre-formatted strings.

import {
  BILLING_DISABLED,
  BILLING_MICROS_PER_UNIT,
  BILLING_UNLIMITED,
  BillingInterval,
  BillingLimitKey,
  BillingProvider,
  type BillingPlanWithPricingDto,
  type BillingUsagePeriodDto,
} from '@repo/shared';
import { useLoading, useUI, formatCurrency, formatDate } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useGetBillingCatalogQuery,
  useGetBillingSummaryQuery,
  useInitiateCheckoutMutation,
  useLazyOpenBillingPortalQuery,
} from '../api/billing.api';

import { BillingDrawerComponent } from './BillingDrawer.component';
import type {
  BillingDrawerProps,
  BillingPlanCard,
  BillingUsageRow,
} from './BillingDrawer.types';

import { getErrorI18nKey } from '@/utils/errorHandler';

/** Format a micros price into a display string. Free → the localized "Free" label. */
function formatPriceMicros(micros: number, currency: string, freeLabel: string): string {
  if (micros === 0) {
    return freeLabel;
  }
  const major = micros / BILLING_MICROS_PER_UNIT;
  return formatCurrency(major, 'en-US', currency, major % 1 === 0 ? 0 : 2);
}

/** Format a limit value: -1 → unlimited, 0 → disabled, N → grouped number. */
function formatLimit(limit: number, unlimitedLabel: string, disabledLabel: string): string {
  if (limit === BILLING_UNLIMITED) {
    return unlimitedLabel;
  }
  if (limit === BILLING_DISABLED) {
    return disabledLabel;
  }
  return new Intl.NumberFormat('en-US').format(limit);
}

/** Progress bar value 0–100 (0 when unlimited/disabled). */
function usageBarValue(used: number, limit: number): number {
  if (limit === BILLING_UNLIMITED || limit === BILLING_DISABLED || limit <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

/** Progress bar variant derived from utilization. */
function usageBarVariant(used: number, limit: number): BillingUsageRow['barVariant'] {
  if (limit === BILLING_UNLIMITED || limit === BILLING_DISABLED || limit <= 0) {
    return 'default';
  }
  const pct = (used / limit) * 100;
  if (pct >= 100) {
    return 'error';
  }
  if (pct >= 80) {
    return 'warning';
  }
  return 'success';
}

/** Resolve the effective limit value for a key from a plan, defaulting to 0. */
function planLimitValue(plan: BillingPlanWithPricingDto, key: BillingLimitKey): number {
  return plan.limits[key]?.limitValue ?? 0;
}

/** Resolve the current used quantity for a limit key from open usage periods. */
function usedQtyForPeriod(periods: BillingUsagePeriodDto[], key: BillingLimitKey): number {
  // Compare by string value — the DTO stores limitKey as a plain string (VARCHAR
  // in DB) and BillingLimitKey is a TS enum; direct === trips the
  // no-unsafe-enum-comparison lint rule.
  const period = periods.find((p) => String(p.limitKey) === String(key));
  return period?.usedQty ?? 0;
}

/** Pick the "highlighted" plan (heuristic: the lowest displayOrder non-free plan). */
function pickHighlightedPlanSlug(plans: BillingPlanWithPricingDto[]): string | null {
  const candidates = plans
    .filter((p) => p.slug !== 'free')
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return candidates[0]?.slug ?? null;
}

export const BillingDrawer: React.FC<BillingDrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation(['translation', 'billing']);
  const { showMessage, closeMessage } = useUI();

  // Catalog + summary always render (backend serves them even when no provider
  // is configured — they are informational in that case).
  const { data: catalog, error: catalogError } = useGetBillingCatalogQuery(undefined, {
    skip: !isOpen,
  });
  const { data: summary, error: summaryError } = useGetBillingSummaryQuery(undefined, {
    skip: !isOpen,
  });

  const [initiateCheckout, { isLoading: isCheckoutLoading }] = useInitiateCheckoutMutation();
  const [triggerPortal, { isFetching: isPortalFetching }] = useLazyOpenBillingPortalQuery();

  useLoading(isCheckoutLoading || isPortalFetching);

  const [compareInterval, setCompareInterval] = useState<BillingInterval>(BillingInterval.MONTHLY);

  // Surface catalog/summary fetch errors via MessageModal (skip 401 — the baseApi
  // refresh layer handles it). The drawer still renders with empty state.
  React.useEffect(() => {
    const error = catalogError ?? summaryError;
    if (!error) {
      return;
    }
    if ('status' in error && error.status === 401) {
      return;
    }
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: getErrorI18nKey(error),
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      t,
    );
  }, [catalogError, summaryError, showMessage, closeMessage, t]);

  const providerUnconfigured = useMemo(() => {
    const provider = summary?.provider ?? catalog?.provider ?? BillingProvider.LOCAL;
    // Compare by string value — the DTO field and the enum literal are the same
    // BillingProvider, but the no-unsafe-enum-comparison lint rule is
    // conservative across the @repo/shared re-export boundary. String-coerce
    // both sides so the comparison is string-to-string.
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
    ? formatDate(subscription.currentPeriodEnd, 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const usageRows: BillingUsageRow[] = useMemo(() => {
    if (!summary || !subscription) {
      return [];
    }
    const plan = summary.plan;
    const periods = summary.usagePeriods;
    if (!plan) {
      return [];
    }
    const unlimitedLabel = t('billing:billing.limits.unlimited');
    const disabledLabel = t('billing:billing.limits.disabled');

    const rows: BillingUsageRow[] = [];
    for (const key of [BillingLimitKey.LISTINGS_PER_MONTH, BillingLimitKey.AMAZON_ORDERS_PER_MONTH]) {
      const limit = planLimitValue(plan, key);
      const used = usedQtyForPeriod(periods, key);
      const labelKey = `billing:billing.limits.${key}.label`;
      const limitDisplay = formatLimit(limit, unlimitedLabel, disabledLabel);
      const usedDisplay = new Intl.NumberFormat('en-US').format(used);
      const ofDisplay = t('billing:billing.limits.of', { used: usedDisplay, limit: limitDisplay });
      rows.push({
        labelKey,
        usedDisplay,
        limitDisplay,
        ofDisplay,
        barValue: usageBarValue(used, limit),
        barVariant: usageBarVariant(used, limit),
        barAriaLabel: `${t(labelKey)}: ${usedDisplay} / ${limitDisplay}`,
      });
    }
    return rows;
  }, [summary, subscription, t]);

  const plans: BillingPlanCard[] = useMemo(() => {
    if (!catalog) {
      return [];
    }
    const unlimitedLabel = t('billing:billing.limits.unlimited');
    const disabledLabel = t('billing:billing.limits.disabled');
    const freeLabel = t('billing:billing.plans.free.name');
    const highlightedSlug = pickHighlightedPlanSlug(catalog.plans);
    return catalog.plans.map((plan) => {
      const price = plan.prices[compareInterval] ?? null;
      const priceDisplay = price
        ? formatPriceMicros(price.amountMicros, price.currency, freeLabel)
        : '—';
      return {
        planId: plan.id,
        slug: plan.slug,
        priceDisplay,
        listingsLimitDisplay: formatLimit(planLimitValue(plan, BillingLimitKey.LISTINGS_PER_MONTH), unlimitedLabel, disabledLabel),
        amazonOrdersLimitDisplay: formatLimit(planLimitValue(plan, BillingLimitKey.AMAZON_ORDERS_PER_MONTH), unlimitedLabel, disabledLabel),
        isCurrent: currentPlanSlug === plan.slug,
        isHighlighted: plan.slug === highlightedSlug,
      };
    });
  }, [catalog, compareInterval, currentPlanSlug, t]);

  // Surface a billing error (checkout 409, portal 409, etc.) via MessageModal.
  const surfaceBillingError = React.useCallback(
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

  const handleCheckout = React.useCallback(
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
      void initiateCheckout({ planId, interval: compareInterval })
        .unwrap()
        .then((result) => {
          if (result.checkoutUrl) {
            window.location.href = result.checkoutUrl;
          }
        })
        .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
          surfaceBillingError(error);
        });
    },
    [providerUnconfigured, compareInterval, initiateCheckout, showMessage, closeMessage, t, surfaceBillingError],
  );

  const handleManage = React.useCallback(() => {
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
    <BillingDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
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
      onSelectCompareInterval={setCompareInterval}
      onCheckout={handleCheckout}
      onManage={handleManage}
      isActionLoading={isCheckoutLoading || isPortalFetching}
    />
  );
};

BillingDrawer.displayName = 'BillingDrawer';
