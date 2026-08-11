import { Drawer, EmptyState, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingRevisionsDrawer.style';
import type { ListingRevisionRow, ListingRevisionsDrawerComponentProps } from './ListingRevisionsDrawer.types';

const directionTone = (changed: boolean, increased: boolean): 'up' | 'down' | 'flat' => {
  if (!changed) {
    return 'flat';
  }
  return increased ? 'up' : 'down';
};

const ChangeCell = ({
  label,
  previous,
  next,
  changed,
  increased,
}: {
  label: string;
  previous: string;
  next: string;
  changed: boolean;
  increased: boolean;
}): React.ReactElement => (
  <S.ChangeItem>
    <Text variant="caption" color="text.tertiary">
      {label}
    </Text>
    <S.ChangeValues>
      <Text variant="body-sm" color="text.secondary" numeric>
        {previous}
      </Text>
      <S.Arrow $tone={directionTone(changed, increased)}>
        <Icon
          name={changed ? (increased ? 'arrow-up-right' : 'arrow-down-right') : 'arrow-right'}
          size={14}
        />
      </S.Arrow>
      <Text variant="body-sm" color="text.primary" numeric>
        {next}
      </Text>
    </S.ChangeValues>
  </S.ChangeItem>
);

const RevisionRow = ({ row }: { row: ListingRevisionRow }): React.ReactElement => {
  const { t } = useTranslation(['listings']);
  return (
    <S.Row>
      <Text variant="caption" color="text.tertiary">
        {row.recordedAt}
      </Text>
      <S.ChangeGrid>
        <ChangeCell
          label={t('listings.detail.revisions.priceChange')}
          previous={row.previousPrice}
          next={row.newPrice}
          changed={row.priceChanged}
          increased={row.priceIncreased}
        />
        <ChangeCell
          label={t('listings.detail.revisions.quantityChange')}
          previous={row.previousQuantity}
          next={row.newQuantity}
          changed={row.quantityChanged}
          increased={row.quantityIncreased}
        />
      </S.ChangeGrid>
    </S.Row>
  );
};

export const ListingRevisionsDrawerComponent = ({
  isOpen,
  onClose,
  isLoading,
  isError,
  rows,
  page,
  totalPages,
  hasPrev,
  hasNext,
  onPrevPage,
  onNextPage,
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
                <RevisionRow key={row.id} row={row} />
              ))}
            </S.List>
            {totalPages > 1 && (
              <S.PagerRow>
                <S.PagerButton
                  type="button"
                  variant="ghost"
                  disabled={!hasPrev}
                  onClick={onPrevPage}
                  aria-label={t('translation:common.previous')}
                >
                  <Icon name="chevron-left" size={16} />
                </S.PagerButton>
                <Text variant="caption" color="text.secondary">
                  {t('listings.detail.revisions.pageInfo', { page, totalPages })}
                </Text>
                <S.PagerButton
                  type="button"
                  variant="ghost"
                  disabled={!hasNext}
                  onClick={onNextPage}
                  aria-label={t('translation:common.next')}
                >
                  <Icon name="chevron-right" size={16} />
                </S.PagerButton>
              </S.PagerRow>
            )}
          </>
        )}
      </S.BodyStack>
    </Drawer>
  );
};

ListingRevisionsDrawerComponent.displayName = 'ListingRevisionsDrawerComponent';
