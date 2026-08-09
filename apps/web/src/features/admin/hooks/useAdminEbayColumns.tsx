import {
  type AdminListingFailureDto,
  type EbayCallBudgetStatusDto,
} from '@repo/shared';
import { Badge, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Utilization band for a resource, so an operator sees the risk before it bites. */
function utilizationVariant(used: number, limit: number): 'neutral' | 'success' | 'warning' | 'error' {
  if (limit <= 0) {
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
 * Both are read-only. The budget table exists because eBay meters calls per
 * APPLICATION — one shared pool for every seller — so exhausting a resource is
 * a platform incident, not a per-customer one, and it has to be visible before
 * it happens rather than diagnosed afterwards from failed jobs.
 */
export function useAdminEbayColumns(): {
  budgetColumns: TableColumn<EbayCallBudgetStatusDto>[];
  failureColumns: TableColumn<AdminListingFailureDto>[];
} {
  const { t, i18n } = useTranslation(['admin', 'listings', 'translation']);

  const budgetColumns = useMemo<TableColumn<EbayCallBudgetStatusDto>[]>(
    () => [
      {
        key: 'resource',
        header: t('admin.ebayLimits.resource'),
        render: (_value, row) => <Text variant="body-sm">{row.resource}</Text>,
      },
      {
        key: 'used',
        header: t('admin.ebayLimits.used'),
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {row.used.toLocaleString(i18n.language)}
          </Text>
        ),
      },
      {
        key: 'limit',
        header: t('admin.ebayLimits.limit'),
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {row.limit.toLocaleString(i18n.language)}
          </Text>
        ),
      },
      {
        key: 'remaining',
        header: t('admin.ebayLimits.remaining'),
        align: 'right',
        render: (_value, row) => (
          <Badge variant={utilizationVariant(row.used, row.limit)} size="sm">
            {row.remaining.toLocaleString(i18n.language)}
          </Badge>
        ),
      },
      {
        key: 'backgroundLimit',
        header: t('admin.ebayLimits.backgroundLimit'),
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" numeric color="text.secondary">
            {row.backgroundLimit.toLocaleString(i18n.language)}
          </Text>
        ),
      },
      {
        key: 'resetAt',
        header: t('admin.ebayLimits.resetAt'),
        render: (_value, row) => (
          <Text variant="body-sm" color="text.secondary">
            {new Date(row.resetAt).toLocaleString(i18n.language)}
          </Text>
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

  return { budgetColumns, failureColumns };
}
