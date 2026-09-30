import { Icon, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReturnBucketBadge } from '../ReturnBucketBadge';

import * as S from './ReturnCard.style';
import type { ReturnCardProps } from './ReturnCard.types';

const EMPTY_VALUE = '—';

/**
 * Grid-view twin of a returns table row: the same facts in the same order —
 * which product, which return, what is due and by when, why, how much.
 */
export const ReturnCard: React.FC<ReturnCardProps> = ({ row, onOpen, onKeyDown, className }) => {
  const { t } = useTranslation(['returns']);
  const clickable = Boolean(onOpen);

  return (
    <S.Wrapper
      padding="lg"
      className={className}
      $clickable={clickable}
      onClick={onOpen}
      onKeyDown={clickable ? onKeyDown : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? t('returns.viewOrder') : undefined}
    >
      <S.Header>
        <S.Image>{row.imageUrl ? <img src={row.imageUrl} alt="" /> : <Icon name="image" size={28} />}</S.Image>
        <S.HeaderText>
          <S.TitleRow>
            <S.Title variant="body" weight="semibold" color="text.primary">
              {row.productTitle}
            </S.Title>
            <ReturnBucketBadge bucket={row.bucket} size="sm" />
          </S.TitleRow>
          <S.IdRow>
            <Text variant="caption" color="text.tertiary">
              {t('returns.columns.return')}
            </Text>
            <Text variant="caption" weight="semibold" color="text.primary" numeric>
              {row.returnId}
            </Text>
          </S.IdRow>
          {row.ebayOrderId && (
            <S.IdRow>
              <Text variant="caption" color="text.tertiary">
                {t('returns.order')}
              </Text>
              <Text variant="caption" color="text.secondary" numeric>
                {row.ebayOrderId}
              </Text>
            </S.IdRow>
          )}
        </S.HeaderText>
      </S.Header>

      <S.Facts>
        <S.Fact $wide>
          <S.FactLabel variant="caption" color="text.tertiary">
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
          <S.FactLabel variant="caption" color="text.tertiary">
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
          <S.FactLabel variant="caption" color="text.tertiary">
            {t('returns.columns.opened')}
          </S.FactLabel>
          <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
            {row.openedAt ?? EMPTY_VALUE}
          </Text>
        </S.Fact>
      </S.Facts>

      <S.Reason>
        <S.IdRow>
          <Text variant="caption" color="text.tertiary">
            {t('returns.columns.reason')}
          </Text>
          <Text variant="caption" weight="semibold" color="text.primary">
            {row.reasonLabel}
          </Text>
        </S.IdRow>
        {row.buyerComment && (
          <Tooltip content={row.buyerComment} position="top" variant="dark">
            <S.Comment variant="body-sm" color="text.secondary">
              {row.buyerComment}
            </S.Comment>
          </Tooltip>
        )}
      </S.Reason>

      {clickable && (
        <S.Footer>
          <S.DetailAction>
            <Text variant="body-sm" weight="semibold" color="brand.primary">
              {t('returns.viewOrder')}
            </Text>
            <Icon name="arrow-right" size={14} color="brand.primary" />
          </S.DetailAction>
        </S.Footer>
      )}
    </S.Wrapper>
  );
};

ReturnCard.displayName = 'ReturnCard';
