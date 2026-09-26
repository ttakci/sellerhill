import type { AdminListingFailureDto, EbayBudgetResourceRowDto, EbayRateLimitResourceDto } from '@repo/shared';
import { Badge, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Utilization band for a resource, so an operator sees the risk before it bites. */
function utilizationVariant(used: number, limit: number | null): 'neutral' | 'success' | 'warning' | 'error' {
  if (limit === null || limit <= 0) {
    return 'neutral';
  }
  const share = used / limit;
  if (share >= 0.9) {
    return 'error';
  }
  if (share >= 0.6) {
    return 'warning';
  }
  return 'success';
}

/**
 * Columns for the two eBay operations tabs.
 *
 * All three are read-only. The budget table exists because eBay meters calls
 * per APPLICATION — one shared pool for every seller — so exhausting a
 * resource is a platform incident, not a per-customer one, and it has to be
 * visible before it happens rather than diagnosed afterwards from failed
 * jobs. The ceilings shown here come from eBay's own `getRateLimits`, never
 * from a typed-in default — the unmapped table is what keeps that mapping
 * honest when eBay adds or renames a resource we don't yet govern.
 */
export function useAdminEbayColumns(): {
  budgetColumns: TableColumn<EbayBudgetResourceRowDto>[];
  unmappedColumns: TableColumn<EbayRateLimitResourceDto>[];
  failureColumns: TableColumn<AdminListingFailureDto>[];
} {
  const { t, i18n } = useTranslation(['admin', 'listings', 'translation']);

  const budgetColumns = useMemo<TableColumn<EbayBudgetResourceRowDto>[]>(
    () => [
      {
        key: 'resource',
        header: t('admin.ebayLimits.resource'),
        render: (_value, row) => (
          <>
            <Text variant="body-sm">{row.resource}</Text>
            <Text variant="caption" color="text.tertiary">
              {row.ebayResource}
            </Text>
          </>
        ),
      },
      {
        key: 'ebayLimit',
        header: t('admin.ebayLimits.ebayLimit'),
        align: 'right',
        render: (_value, row) =>
          row.ebayLimit === null ? (
            <Text variant="caption" color="text.tertiary">
              {t('admin.ebayLimits.noEbayFigure')}
            </Text>
          ) : (
            <>
              <Text variant="body-sm" numeric>
                {row.ebayLimit.toLocaleString(i18n.language)}
              </Text>
              {row.otherWindows.map((window) => (
                <div key={`${window.timeWindowSeconds}-${window.limit}`}>
                  <Text variant="caption" color="text.tertiary">
                    {t('admin.ebayLimits.otherWindow', {
                      limit: window.limit.toLocaleString(i18n.language),
                      seconds: window.timeWindowSeconds,
                    })}
                  </Text>
                </div>
              ))}
            </>
          ),
      },
      {
        key: 'ebayRemaining',
        header: t('admin.ebayLimits.ebayRemaining'),
        align: 'right',
        render: (_value, row) =>
          row.ebayRemaining === null ? (
            <Text variant="body-sm" color="text.tertiary">
              —
            </Text>
          ) : (
            <Badge
              variant={
                row.ebayLimit === null
                  ? 'neutral'
                  : utilizationVariant(row.ebayLimit - row.ebayRemaining, row.ebayLimit)
              }
              size="sm"
            >
              {row.ebayRemaining.toLocaleString(i18n.language)}
            </Badge>
          ),
      },
      {
        key: 'ebayResetAt',
        header: t('admin.ebayLimits.ebayResetAt'),
        render: (_value, row) => (
          <Text variant="body-sm" color="text.secondary">
            {row.ebayResetAt === null ? '—' : new Date(row.ebayResetAt).toLocaleString(i18n.language)}
          </Text>
        ),
      },
      {
        key: 'ourCount',
        header: t('admin.ebayLimits.ourCount'),
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {row.ourCount.toLocaleString(i18n.language)}
          </Text>
        ),
      },
      {
        key: 'backgroundLimit',
        header: t('admin.ebayLimits.backgroundLimit'),
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" numeric color="text.secondary">
            {row.backgroundLimit === null ? '—' : row.backgroundLimit.toLocaleString(i18n.language)}
          </Text>
        ),
      },
      {
        key: 'ourResetAt',
        header: t('admin.ebayLimits.ourResetAt'),
        render: (_value, row) => (
          <Text variant="body-sm" color="text.secondary">
            {new Date(row.ourResetAt).toLocaleString(i18n.language)}
          </Text>
        ),
      },
    ],
    [t, i18n.language]
  );

  const unmappedColumns = useMemo<TableColumn<EbayRateLimitResourceDto>[]>(
    () => [
      {
        key: 'apiName',
        header: t('admin.ebayLimits.apiName'),
        render: (_value, row) => (
          <Text variant="body-sm">{`${row.apiName} (${row.apiContext}, ${row.apiVersion})`}</Text>
        ),
      },
      {
        key: 'resourceName',
        header: t('admin.ebayLimits.resourceName'),
        render: (_value, row) => <Text variant="mono">{row.resourceName}</Text>,
      },
      {
        key: 'windows',
        header: t('admin.ebayLimits.windows'),
        render: (_value, row) =>
          row.windows.length === 0 ? (
            <Text variant="body-sm" color="text.tertiary">
              {t('admin.ebayLimits.noRate')}
            </Text>
          ) : (
            <>
              {row.windows.map((window) => (
                <div key={`${window.timeWindowSeconds}-${window.limit}`}>
                  <Text variant="caption" color="text.secondary">
                    {t('admin.ebayLimits.windowLine', {
                      limit: window.limit.toLocaleString(i18n.language),
                      seconds: window.timeWindowSeconds,
                      remaining: window.remaining.toLocaleString(i18n.language),
                    })}
                  </Text>
                </div>
              ))}
            </>
          ),
      },
    ],
    [t, i18n.language]
  );

  const failureColumns = useMemo<TableColumn<AdminListingFailureDto>[]>(
    () => [
      {
        key: 'asin',
        header: t('admin.listingFailures.asin'),
        render: (_value, row) => <Text variant="mono">{row.asin}</Text>,
      },
      {
        key: 'userEmail',
        header: t('admin.listingFailures.seller'),
        render: (_value, row) => <Text variant="body-sm">{row.userEmail}</Text>,
      },
      {
        key: 'failureCode',
        header: t('admin.listingFailures.code'),
        render: (_value, row) => (
          <Badge variant="neutral" size="sm">
            {row.failureCode ?? t('admin.listingFailures.uncoded')}
          </Badge>
        ),
      },
      {
        key: 'sellerSees',
        header: t('admin.listingFailures.sellerSees'),
        render: (_value, row) =>
          row.failureCode ? (
            <Text variant="body-sm" color="text.secondary">
              {t(`listings:listings.jobs.failure.${row.failureCode}`, { aspects: '' })}
            </Text>
          ) : (
            <Text variant="body-sm" color="text.tertiary">
              —
            </Text>
          ),
      },
      {
        key: 'technicalMessage',
        header: t('admin.listingFailures.technical'),
        // The provider's own wording. Deliberately absent from every
        // customer-facing surface — it names eBay error ids and internal
        // fields, which reads to a seller like a defect in their product.
        render: (_value, row) => (
          <Text variant="body-sm">{row.technicalMessage ?? '—'}</Text>
        ),
      },
      {
        key: 'attemptedAt',
        header: t('admin.listingFailures.attemptedAt'),
        render: (_value, row) => (
          <Text variant="body-sm" color="text.secondary">
            {new Date(row.attemptedAt).toLocaleString(i18n.language)}
          </Text>
        ),
      },
    ],
    [t, i18n.language]
  );

  return { budgetColumns, unmappedColumns, failureColumns };
}
