import { UserStatus, type AdminUserDto } from '@repo/shared';
import { Badge, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Real table columns for the admin Users tab.
 *
 * The tab used to render one flex row per user with listings / orders / Keepa /
 * LLM interpolated into a single sentence, so none of those figures were
 * independently scannable, alignable or sortable — the opposite of what an
 * operator console needs. Each is now its own right-aligned numeric column.
 */
export function useAdminUserColumns(
  formatCost: (micros: number | null, currency: string | null) => string
) {
  const { t } = useTranslation(['admin', 'translation']);

  return useMemo<TableColumn<AdminUserDto>[]>(
    () => [
      {
        key: 'email',
        header: t('admin.users.columns.user'),
        width: '18rem',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" weight="semibold" truncate>
            {row.email}
          </Text>
        ),
      },
      {
        key: 'role',
        header: t('admin.users.columns.role'),
        width: '8rem',
        render: (_value, row) => (
          <Badge variant="neutral" size="sm">
            {t(`admin.billing.accessTier.${row.role}`, { defaultValue: row.role })}
          </Badge>
        ),
      },
      {
        key: 'status',
        header: t('admin.users.columns.status'),
        width: '8rem',
        render: (_value, row) => (
          <Badge variant={row.status === UserStatus.ACTIVE ? 'success' : 'warning'} size="sm">
            {t(`admin.billing.accountStatus.${row.status}`, { defaultValue: row.status })}
          </Badge>
        ),
      },
      {
        key: 'activeListings',
        header: t('admin.users.columns.listings'),
        width: '6.5rem',
        align: 'right',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {row.activeListings}
          </Text>
        ),
      },
      {
        key: 'ordersLast30Days',
        header: t('admin.users.columns.orders'),
        width: '6.5rem',
        align: 'right',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {row.ordersLast30Days}
          </Text>
        ),
      },
      {
        key: 'keepaTokens',
        header: t('admin.users.columns.keepa'),
        width: '7rem',
        align: 'right',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {row.keepaTokens}
          </Text>
        ),
      },
      {
        key: 'llmTokens',
        header: t('admin.users.columns.llm'),
        width: '7rem',
        align: 'right',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {row.llmTokens}
          </Text>
        ),
      },
      {
        key: 'estimatedCostMicros',
        header: t('admin.users.columns.cost'),
        width: '8rem',
        align: 'right',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" weight="semibold" numeric>
            {formatCost(row.estimatedCostMicros, row.currency)}
          </Text>
        ),
      },
    ],
    [t, formatCost]
  );
}
