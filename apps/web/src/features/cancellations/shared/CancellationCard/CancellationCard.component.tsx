import { Icon, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './CancellationCard.style';
import type { CancellationCardProps } from './CancellationCard.types';

import { ReturnBucketBadgeComponent } from '@/features/returns/shared/ReturnBucketBadge';

const EMPTY_VALUE = '—';

/**
 * Grid-view twin of a cancellations table row — same anatomy as ReturnCard /
 * ListingCard / OrderCard: badge, title, photo on the left, label + bold value
 * facts on the right, the deadline and the refund under one hairline.
 */
export const CancellationCard: React.FC<CancellationCardProps> = ({ row, onOpen, onKeyDown, className }) => {
  const { t } = useTranslation(['cancellations', 'translation']);
  const clickable = Boolean(onOpen);

  const facts: { label: string; value: string | null }[] = [
    { label: t('cancellations.columns.request'), value: row.cancelId },
    { label: t('cancellations.order'), value: row.ebayOrderId },
    { label: t('cancellations.columns.buyer'), value: row.buyerLoginName },
    { label: t('cancellations.columns.reason'), value: row.reasonLabel },
    { label: t('cancellations.columns.requested'), value: row.requestedAt },
  ];

  return (
    <S.Wrapper
      className={className}
      $clickable={clickable}
      onClick={onOpen}
      onKeyDown={clickable ? onKeyDown : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? t('cancellations.detail.open') : undefined}
    >
      <S.Top>
        <S.BadgeRow>
          <ReturnBucketBadgeComponent
            label={row.bucketLabel}
            tooltip={row.bucketHint}
            variant={row.bucketVariant}
            icon={row.bucketIcon}
            size="sm"
          />
        </S.BadgeRow>

        <S.TitleRow>
          <S.TitleSlot>
            <Tooltip content={row.productTitle} position="top" variant="dark">
              <S.Title variant="body" weight="semibold" color="text.primary">
                {row.productTitle}
              </S.Title>
            </Tooltip>
          </S.TitleSlot>
        </S.TitleRow>

        <S.Body>
          <S.Image>{row.imageUrl ? <img src={row.imageUrl} alt="" /> : <Icon name="image" size={28} />}</S.Image>

          <S.Content>
            <S.MetaList>
              {facts.map(
                ({ label, value }) =>
                  value && (
                    <React.Fragment key={label}>
                      <S.MetaLabel>
                        <Text variant="caption" color="text.secondary">
                          {label}
                        </Text>
                      </S.MetaLabel>
                      <S.MetaValue>
                        <Text variant="body-sm" weight="bold" color="text.primary" numeric>
                          {value}
                        </Text>
                      </S.MetaValue>
                    </React.Fragment>
                  )
              )}
            </S.MetaList>
          </S.Content>
        </S.Body>
      </S.Top>

      <S.Facts>
        <S.Fact>
          <S.FactLabel variant="caption" color="text.secondary">
            {t('cancellations.columns.due')}
          </S.FactLabel>
          <Text variant="body-sm" weight="semibold" color="text.primary">
            {row.dueLabel ?? EMPTY_VALUE}
          </Text>
          {row.dueBy && (
            <Text variant="caption" weight="medium" color={row.isOverdue ? 'semantic.error' : 'text.secondary'}>
              {row.dueBy}
            </Text>
          )}
        </S.Fact>
        <S.Fact>
          <S.FactLabel variant="caption" color="text.secondary">
            {t('cancellations.columns.refund')}
          </S.FactLabel>
          <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
            {row.refundAmount ?? EMPTY_VALUE}
          </Text>
        </S.Fact>
      </S.Facts>
    </S.Wrapper>
  );
};

CancellationCard.displayName = 'CancellationCard';
