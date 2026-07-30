import { ProxyExpiryState, ProxyStatus, type AdminProxyDto } from '@repo/shared';
import { Badge, Button, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Server-derived expiry state -> badge tone. */
const EXPIRY_VARIANT: Record<ProxyExpiryState, 'neutral' | 'success' | 'warning' | 'error'> = {
  [ProxyExpiryState.NO_EXPIRY]: 'neutral',
  [ProxyExpiryState.OK]: 'success',
  [ProxyExpiryState.EXPIRING_SOON]: 'warning',
  [ProxyExpiryState.EXPIRED]: 'error',
};

/**
 * Real table columns for the admin Proxies tab, replacing a flex-row list that
 * joined label, assignee, expiry and cost into two run-on sentences per row.
 */
export function useAdminProxyColumns(
  formatCost: (micros: number | null, currency: string | null) => string,
  formatDateValue: (value: string | null) => string,
  onToggleStatus: (proxy: AdminProxyDto) => void,
  isSaving: boolean
) {
  const { t } = useTranslation(['admin', 'translation']);

  return useMemo<TableColumn<AdminProxyDto>[]>(
    () => [
      {
        key: 'host',
        header: t('admin.proxies.columns.endpoint'),
        width: '13rem',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" weight="semibold" numeric truncate>
            {`${row.host}:${row.port}`}
          </Text>
        ),
      },
      {
        key: 'label',
        header: t('admin.proxies.columns.label'),
        width: '11rem',
        render: (_value, row) => (
          <Text variant="body-sm" color="text.secondary" truncate>
            {row.label ?? '—'}
          </Text>
        ),
      },
      {
        key: 'assignedUserEmail',
        header: t('admin.proxies.columns.assignee'),
        width: '14rem',
        render: (_value, row) => (
          <Text variant="body-sm" color={row.assignedUserEmail ? 'text.primary' : 'text.tertiary'} truncate>
            {row.assignedUserEmail ?? t('admin.proxies.unassigned')}
          </Text>
        ),
      },
      {
        key: 'status',
        header: t('admin.proxies.columns.status'),
        width: '7rem',
        render: (_value, row) => (
          <Badge variant={row.status === ProxyStatus.ACTIVE ? 'success' : 'neutral'} size="sm">
            {t(`admin.proxies.status.${row.status}`)}
          </Badge>
        ),
      },
      {
        key: 'expiresAt',
        header: t('admin.proxies.columns.expiry'),
        width: '11rem',
        sortable: true,
        render: (_value, row) =>
          row.expiryState === ProxyExpiryState.NO_EXPIRY ? (
            <Text variant="body-sm" color="text.tertiary">
              {t('admin.proxies.noExpiry')}
            </Text>
          ) : (
            <Badge variant={EXPIRY_VARIANT[row.expiryState]} size="sm">
              {formatDateValue(row.expiresAt)}
            </Badge>
          ),
      },
      {
        key: 'monthlyCostMicros',
        header: t('admin.proxies.columns.cost'),
        width: '8rem',
        align: 'right',
        sortable: true,
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {formatCost(row.monthlyCostMicros, row.currency)}
          </Text>
        ),
      },
      {
        key: 'actions',
        header: t('admin.proxies.columns.actions'),
        width: '7.5rem',
        align: 'right',
        render: (_value, row) => (
          <Button
            variant="secondary"
            size="xsmall"
            onClick={() => onToggleStatus(row)}
            disabled={isSaving}
          >
            <Text variant="caption" weight="semibold">
              {row.status === ProxyStatus.ACTIVE
                ? t('admin.proxies.disable')
                : t('admin.proxies.enable')}
            </Text>
          </Button>
        ),
      },
    ],
    [t, formatCost, formatDateValue, onToggleStatus, isSaving]
  );
}
