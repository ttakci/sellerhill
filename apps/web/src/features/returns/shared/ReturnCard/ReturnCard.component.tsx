import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReturnBucketBadge } from '../ReturnBucketBadge';

import type { ReturnCardProps } from './ReturnCard.types';

import { OrderCard } from '@/features/orders/shared/OrderCard';

const EMPTY_VALUE = '—';

/**
 * Grid-view twin of a returns table row, drawn BY the orders card so the two
 * can never drift apart: status badge, title, the photo with labelled facts,
 * then one figures row (refund · deadline · opened) ending in "Details ›".
 */
export const ReturnCard: React.FC<ReturnCardProps> = ({ row, onOpen, className }) => {
  const { t } = useTranslation(['returns', 'translation']);

  const meta = [
    { label: t('returns.columns.return'), value: row.returnId },
    ...(row.ebayOrderId ? [{ label: t('returns.order'), value: row.ebayOrderId }] : []),
    { label: t('returns.columns.reason'), value: row.reasonLabel },
    ...(row.dueLabel ? [{ label: t('returns.columns.due'), value: row.dueLabel }] : []),
    ...row.productMeta.map((item) => ({ label: item.label, value: item.id, storeType: item.storeType })),
  ];

  return (
    <OrderCard
      className={className}
      productTitle={row.productTitle}
      imageUrl={row.imageUrl}
      ebayOrderId={row.returnId}
      showStage={false}
      leadingBadge={<ReturnBucketBadge bucket={row.bucket} size="sm" />}
      meta={meta}
      stats={[
        // The label says whether the money went out ("Refunded") or is eBay's estimate — no separate chip.
        {
          label:
            row.refundLabel && !row.isRefunded
              ? `${t('returns.columns.refund')} · ${row.refundLabel}`
              : row.refundLabel ?? t('returns.columns.refund'),
          value: row.refundAmount ?? EMPTY_VALUE,
          tone: row.isRefunded ? 'positive' : 'default',
        },
        {
          label: t('returns.columns.deadline'),
          value: row.dueDate ?? EMPTY_VALUE,
          tone: row.isOverdue ? 'negative' : 'default',
        },
        { label: t('returns.columns.opened'), value: row.openedAt ?? EMPTY_VALUE },
      ]}
      detailLabel={onOpen ? t('translation:common.details') : undefined}
      onClick={onOpen}
    />
  );
};

ReturnCard.displayName = 'ReturnCard';
