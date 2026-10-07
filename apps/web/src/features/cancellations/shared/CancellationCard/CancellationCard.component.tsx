import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CancellationCardProps } from './CancellationCard.types';

import { OrderCard } from '@/features/orders/shared/OrderCard';
import { ReturnBucketBadgeComponent } from '@/features/returns/shared/ReturnBucketBadge';

const EMPTY_VALUE = '—';

/**
 * Grid-view twin of a cancellations table row, drawn BY the orders card (like the
 * returns card) so the three can never drift apart: status badge, title, the photo
 * with labelled facts, then one figures row (deadline · refund) ending in "Details ›".
 */
export const CancellationCard: React.FC<CancellationCardProps> = ({ row, onOpen, className }) => {
  const { t } = useTranslation(['cancellations', 'translation']);

  const meta = [
    { label: t('cancellations.columns.request'), value: row.cancelId },
    ...(row.ebayOrderId ? [{ label: t('cancellations.order'), value: row.ebayOrderId }] : []),
    ...(row.buyerLoginName ? [{ label: t('cancellations.columns.buyer'), value: row.buyerLoginName }] : []),
    { label: t('cancellations.columns.reason'), value: row.reasonLabel },
    ...(row.requestedAt ? [{ label: t('cancellations.columns.requested'), value: row.requestedAt }] : []),
    ...row.productMeta.map((item) => ({ label: item.label, value: item.id, storeType: item.storeType })),
  ];

  return (
    <OrderCard
      className={className}
      productTitle={row.productTitle}
      imageUrl={row.imageUrl}
      ebayOrderId={row.cancelId}
      showStage={false}
      leadingBadge={
        <ReturnBucketBadgeComponent
          label={row.bucketLabel}
          tooltip={row.bucketHint}
          variant={row.bucketVariant}
          icon={row.bucketIcon}
          size="sm"
        />
      }
      meta={meta}
      stats={[
        {
          label: t('cancellations.columns.deadline'),
          value: row.dueDate ?? EMPTY_VALUE,
          tone: row.isOverdue ? 'negative' : 'default',
        },
        { label: t('cancellations.columns.refund'), value: row.refundAmount ?? EMPTY_VALUE },
      ]}
      detailLabel={onOpen ? t('translation:common.details') : undefined}
      onClick={onOpen}
    />
  );
};

CancellationCard.displayName = 'CancellationCard';
