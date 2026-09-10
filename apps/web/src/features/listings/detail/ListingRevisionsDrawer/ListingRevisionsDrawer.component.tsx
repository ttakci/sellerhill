import { Button, Drawer, EmptyState, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingRevisionsDrawer.style';
import type { ListingRevisionRow, ListingRevisionsDrawerComponentProps } from './ListingRevisionsDrawer.types';

const ChangeLine = ({
  label,
  previous,
  next,
  changed,
  increased,
  delta,
}: {
  label: string;
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
        <ChangeLine
          label={t('listings.detail.revisions.quantityChange')}
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
  rows,
  shown,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
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
