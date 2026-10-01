import { Button, Drawer, EmptyState, Icon, IconButton, InfoMessage, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingRevisionsDrawer.style';
import type { ListingRevisionRow, ListingRevisionsDrawerComponentProps } from './ListingRevisionsDrawer.types';

import { ProductTableCell } from '@/domain-ui';

const ChangeLine = ({
  label,
  labelTooltip,
  previous,
  next,
  changed,
  increased,
  delta,
}: {
  label: string;
  /** Shown as an info-icon tooltip next to the label — for a value that isn't self-explanatory. */
  labelTooltip?: string;
  previous: string;
  next: string;
  changed: boolean;
  increased: boolean;
  delta: string | null;
}): React.ReactElement => {
  const { t } = useTranslation(['listings']);
  return (
    <S.ChangeRow>
      <S.ChangeLabel>
        <Text variant="caption" color="text.tertiary">
          {label}
        </Text>
        {labelTooltip && (
          <Tooltip content={labelTooltip} position="top" variant="dark">
            <Icon name="info" size={12} color="text.tertiary" />
          </Tooltip>
        )}
      </S.ChangeLabel>
      <S.ChangeValues>
        {changed ? (
          <>
            <Text variant="body-sm" color="text.secondary" numeric>
              {previous}
            </Text>
            <S.Arrow $tone={increased ? 'up' : 'down'}>
              <Icon name={increased ? 'arrow-up-right' : 'arrow-down-right'} size={14} />
            </S.Arrow>
            <Text variant="body-sm" color="text.primary" weight="medium" numeric>
              {next}
            </Text>
          </>
        ) : (
          <Text variant="body-sm" color="text.secondary" numeric>
            {next}
          </Text>
        )}
      </S.ChangeValues>
      {changed && delta ? (
        <S.DeltaPill $tone={increased ? 'up' : 'down'}>{delta}</S.DeltaPill>
      ) : (
        <S.MutedNote>
          <Text variant="caption" color="text.tertiary">
            {t('listings.detail.revisions.unchanged')}
          </Text>
        </S.MutedNote>
      )}
    </S.ChangeRow>
  );
};

const RevisionCard = ({ row }: { row: ListingRevisionRow }): React.ReactElement => {
  const { t } = useTranslation(['listings']);
  return (
    <S.Card>
      <S.CardHead>
        <Icon name="clock" size={13} color="text.tertiary" />
        <Text variant="caption" color="text.tertiary" numeric>
          {row.recordedAt}
        </Text>
      </S.CardHead>
      <S.ChangeStack>
        <ChangeLine
          label={t('listings.detail.revisions.priceChange')}
          previous={row.previousPrice}
          next={row.newPrice}
          changed={row.priceChanged}
          increased={row.priceIncreased}
          delta={row.priceDelta}
        />
        {row.newSourceStock !== null && (
          <ChangeLine
            label={t('listings.detail.revisions.sourceStockChange')}
            labelTooltip={t('listings.detail.revisions.sourceStockTooltip')}
            previous={row.previousSourceStock ?? row.newSourceStock}
            next={row.newSourceStock}
            changed={row.sourceStockChanged}
            increased={row.sourceStockIncreased}
            delta={row.sourceStockDelta}
          />
        )}
        <ChangeLine
          label={t('listings.detail.revisions.quantityChange')}
          labelTooltip={t('listings.detail.revisions.quantityTooltip')}
          previous={row.previousQuantity}
          next={row.newQuantity}
          changed={row.quantityChanged}
          increased={row.quantityIncreased}
          delta={row.quantityDelta}
        />
      </S.ChangeStack>
    </S.Card>
  );
};

export const ListingRevisionsDrawerComponent = ({
  isOpen,
  onClose,
  isLoading,
  isError,
  subject,
  onViewListing,
  rows,
  shown,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
  lastCheckedLabel,
}: ListingRevisionsDrawerComponentProps): React.ReactElement => {
  const { t } = useTranslation(['listings', 'translation']);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('listings.detail.revisions.title')}
      subtitle={t('listings.detail.revisions.subtitle')}
      size="md"
    >
      <S.BodyStack>
        {subject && (
          <S.Subject>
            <S.SubjectCell>
              <ProductTableCell
                title={subject.title}
                imageUrl={subject.imageUrl}
                meta={[{ label: t('listings.table.asin'), id: subject.asin, storeType: 'amazon' }]}
                subtitle={subject.storeName}
              />
            </S.SubjectCell>
            {onViewListing && (
              <IconButton
                type="button"
                variant="outlined"
                onClick={onViewListing}
                aria-label={t('listings.revisionHistory.viewListing')}
                title={t('listings.revisionHistory.viewListing')}
              >
                <Icon name="external-link" size={16} />
              </IconButton>
            )}
          </S.Subject>
        )}
        {!isLoading && !isError && lastCheckedLabel ? <InfoMessage>{lastCheckedLabel}</InfoMessage> : null}
        {isLoading || isError || rows.length === 0 ? (
          <S.EmptyWrap>
            <EmptyState
              icon="history"
              title={
                isLoading
                  ? t('translation:common.loading')
                  : isError
                    ? t('listings.detail.revisions.loadFailed')
                    : t('listings.detail.revisions.empty')
              }
              description={isLoading || isError ? '' : t('listings.detail.revisions.emptySubtitle')}
            />
          </S.EmptyWrap>
        ) : (
          <>
            <S.List>
              {rows.map((row) => (
                <RevisionCard key={row.id} row={row} />
              ))}
            </S.List>
            <S.LoadMoreRow>
              {hasMore ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="small"
                  fullWidth
                  isLoading={isLoadingMore}
                  onClick={onLoadMore}
                >
                  <Text variant="body-sm" weight="medium">
                    {t('listings.detail.revisions.loadMore')}
                  </Text>
                </Button>
              ) : null}
              <Text variant="caption" color="text.tertiary">
                {t('listings.detail.revisions.shownInfo', { shown, total })}
              </Text>
            </S.LoadMoreRow>
          </>
        )}
      </S.BodyStack>
    </Drawer>
  );
};

ListingRevisionsDrawerComponent.displayName = 'ListingRevisionsDrawerComponent';
