import { Text, Tooltip, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { ReturnRowView } from '../../returns.types';
import { ReturnBucketBadge } from '../../shared/ReturnBucketBadge';
import * as S from '../ReturnsPage.style';

import { ProductTableCell } from '@/domain-ui';

const EMPTY_VALUE = '—';

/** Table columns over presentation-ready rows — every value is already localized and formatted. */
export function useReturnsColumns() {
  const { t } = useTranslation(['returns', 'translation']);

  return useMemo<TableColumn<ReturnRowView>[]>(
    () => [
      {
        key: 'product',
        header: t('returns.columns.product'),
        width: '18rem',
        render: (_value, row) => (
          <ProductTableCell title={row.productTitle} imageUrl={row.imageUrl} meta={row.productMeta} />
        ),
      },
      {
        key: 'returnId',
        header: t('returns.columns.return'),
        width: '10.5rem',
        render: (_value, row) => (
          <S.StackCell>
            <Text variant="body" weight="semibold" numeric>
              {row.returnId}
            </Text>
            {row.ebayOrderId && (
              <S.InlineMeta>
                <Text variant="caption" color="text.tertiary">
                  {t('returns.order')}
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
        header: t('returns.columns.status'),
        width: '10.5rem',
        render: (_value, row) => <ReturnBucketBadge bucket={row.bucket} size="xs" />,
      },
      {
        // The answer the page exists for: what eBay expects next, and by when.
        key: 'due',
        header: t('returns.columns.due'),
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
        header: t('returns.columns.reason'),
        width: '13rem',
        render: (_value, row) => (
          <S.StackCell>
            <Text variant="body-sm" weight="medium">
              {row.reasonLabel}
            </Text>
            {row.buyerComment && (
              <Tooltip content={row.buyerComment} position="top" variant="dark">
                <S.CommentClamp variant="caption" color="text.secondary">
                  {row.buyerComment}
                </S.CommentClamp>
              </Tooltip>
            )}
          </S.StackCell>
        ),
      },
      {
        key: 'refund',
        header: t('returns.columns.refund'),
        width: '7rem',
        align: 'right',
        render: (_value, row) =>
          row.refundAmount ? (
            <S.StackCell $alignEnd>
              <Text variant="body" weight="semibold" numeric>
                {row.refundAmount}
              </Text>
              {row.refundLabel && (
                <Text variant="caption" color="text.secondary">
                  {row.refundLabel}
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
        key: 'openedAt',
        header: t('returns.columns.opened'),
        width: '7.5rem',
        render: (_value, row) => (
          <Text variant="body-sm" color="text.secondary" numeric>
            {row.openedAt ?? EMPTY_VALUE}
          </Text>
        ),
      },
    ],
    [t]
  );
}
