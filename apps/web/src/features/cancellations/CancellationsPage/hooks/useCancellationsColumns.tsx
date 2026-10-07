import { Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { CancellationRowView } from '../../cancellations.types';
import * as S from '../CancellationsPage.style';

import { ProductTableCell } from '@/domain-ui';
import { ReturnBucketBadgeComponent } from '@/features/returns/shared/ReturnBucketBadge';

const EMPTY_VALUE = '—';

/** Table columns over presentation-ready rows — every value is already localized and formatted. */
export function useCancellationsColumns() {
  const { t } = useTranslation(['cancellations', 'translation']);

  return useMemo<TableColumn<CancellationRowView>[]>(
    () => [
      {
        key: 'product',
        header: t('cancellations.columns.product'),
        width: '18rem',
        render: (_value, row) => (
          <ProductTableCell title={row.productTitle} imageUrl={row.imageUrl} meta={row.productMeta} />
        ),
      },
      {
        key: 'cancelId',
        header: t('cancellations.columns.request'),
        width: '10.5rem',
        render: (_value, row) => (
          <S.StackCell>
            <Text variant="body" weight="semibold" numeric>
              {row.cancelId}
            </Text>
            {row.ebayOrderId && (
              <S.InlineMeta>
                <Text variant="caption" color="text.tertiary">
                  {t('cancellations.order')}
                </Text>
                <Text variant="caption" color="text.secondary" numeric>
                  {row.ebayOrderId}
                </Text>
              </S.InlineMeta>
            )}
          </S.StackCell>
        ),
      },
      {
        key: 'bucket',
        header: t('cancellations.columns.status'),
        width: '10.5rem',
        render: (_value, row) => (
          <ReturnBucketBadgeComponent
            label={row.bucketLabel}
            tooltip={row.bucketHint}
            variant={row.bucketVariant}
            icon={row.bucketIcon}
            size="xs"
          />
        ),
      },
      {
        // The answer the page exists for: what eBay expects next, and by when.
        key: 'due',
        header: t('cancellations.columns.due'),
        width: '13rem',
        render: (_value, row) =>
          row.dueLabel ? (
            <S.StackCell>
              <Text variant="body-sm" weight="semibold">
                {row.dueLabel}
              </Text>
              {row.dueBy && (
                <Text variant="caption" weight="medium" color={row.isOverdue ? 'semantic.error' : 'text.secondary'}>
                  {row.dueBy}
                </Text>
              )}
            </S.StackCell>
          ) : (
            <Text variant="body-sm" color="text.tertiary">
              {EMPTY_VALUE}
            </Text>
          ),
      },
      {
        key: 'reason',
        header: t('cancellations.columns.reason'),
        width: '13rem',
        render: (_value, row) => (
          <Text variant="body-sm" weight="medium">
            {row.reasonLabel}
          </Text>
        ),
      },
      {
        key: 'refund',
        header: t('cancellations.columns.refund'),
        width: '7rem',
        align: 'right',
        render: (_value, row) => (
          <Text variant="body" weight="semibold" color={row.refundAmount ? 'text.primary' : 'text.tertiary'} numeric>
            {row.refundAmount ?? EMPTY_VALUE}
          </Text>
        ),
      },
      {
        key: 'requestedAt',
        header: t('cancellations.columns.requested'),
        width: '7.5rem',
        render: (_value, row) => (
          <Text variant="body-sm" color="text.secondary" numeric>
            {row.requestedAt ?? EMPTY_VALUE}
          </Text>
        ),
      },
    ],
    [t]
  );
}
