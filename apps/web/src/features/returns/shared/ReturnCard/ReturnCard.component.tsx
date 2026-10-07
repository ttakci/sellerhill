import { Icon, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReturnBucketBadge } from '../ReturnBucketBadge';

import * as S from './ReturnCard.style';
import type { ReturnCardProps } from './ReturnCard.types';

const EMPTY_VALUE = '—';

/**
 * Grid-view twin of a returns table row — same anatomy as ListingCard / OrderCard:
 * badge (soluk değil, koyu zemin beyaz font) solda, resim solda, alanlar resmin
 * sağında label + bold value.
 */
export const ReturnCard: React.FC<ReturnCardProps> = ({ row, onOpen, onKeyDown, className }) => {
  const { t } = useTranslation(['returns', 'translation']);
  const clickable = Boolean(onOpen);

  return (
    <S.Wrapper
      className={className}
      $clickable={clickable}
      onClick={onOpen}
      onKeyDown={clickable ? onKeyDown : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? t('returns.detail.open') : undefined}
    >
      <S.Top>
        <S.BadgeRow>
          <ReturnBucketBadge bucket={row.bucket} size="sm" />
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
              <S.MetaLabel>
                <Text variant="caption" color="text.secondary">
                  {t('returns.columns.return')}
                </Text>
              </S.MetaLabel>
              <S.MetaValue>
                <Text variant="body-sm" weight="bold" color="text.primary" numeric>
                  {row.returnId}
                </Text>
              </S.MetaValue>

              {row.ebayOrderId && (
                <>
                  <S.MetaLabel>
                    <Text variant="caption" color="text.secondary">
                      {t('returns.order')}
                    </Text>
                  </S.MetaLabel>
                  <S.MetaValue>
                    <Text variant="body-sm" weight="bold" color="text.primary" numeric>
                      {row.ebayOrderId}
                    </Text>
                  </S.MetaValue>
                </>
              )}

              <S.MetaLabel>
                <Text variant="caption" color="text.secondary">
                  {t('returns.columns.reason')}
                </Text>
              </S.MetaLabel>
              <S.MetaValue>
                <Text variant="body-sm" weight="bold" color="text.primary">
                  {row.reasonLabel}
                </Text>
              </S.MetaValue>
            </S.MetaList>

            {row.buyerComment && (
              <Tooltip content={row.buyerComment} position="top" variant="dark">
                <S.Comment variant="body-sm" color="text.secondary">
                  {row.buyerComment}
                </S.Comment>
              </Tooltip>
            )}
          </S.Content>
        </S.Body>
      </S.Top>

      <S.Facts>
        <S.Fact $wide>
          <S.FactLabel variant="caption" color="text.secondary">
            {t('returns.columns.due')}
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
            {t('returns.columns.refund')}
          </S.FactLabel>
          <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
            {row.refundAmount ?? EMPTY_VALUE}
          </Text>
          {row.refundLabel && (
            <Text variant="caption" color="text.secondary">
              {row.refundLabel}
            </Text>
          )}
        </S.Fact>
        <S.Fact>
          <S.FactLabel variant="caption" color="text.secondary">
            {t('returns.columns.opened')}
          </S.FactLabel>
          <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
            {row.openedAt ?? EMPTY_VALUE}
          </Text>
        </S.Fact>
      </S.Facts>
    </S.Wrapper>
  );
};

ReturnCard.displayName = 'ReturnCard';
