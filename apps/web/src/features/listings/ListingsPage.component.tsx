import { Icon, Table } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ListingsPage.style';
import { ListingsPageProps } from './ListingsPage.types';

export const ListingsPageComponent: React.FC<ListingsPageProps> = ({
  listings,
  isLoading,
  onRefresh,
  onAddListing,
  onEndListings,
  selectedListingIds,
  onSelectionChange,
  onEndSelected,
  columns,
  selectedRows,
  pagination,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.PageTitle>{t('listings.overview.title')}</S.PageTitle>
          <S.PageSubtitle>
            {t('listings.overview.subtitle', { count: listings.length })}
          </S.PageSubtitle>
        </S.HeaderContent>
        <S.Actions>
          {selectedListingIds.length > 0 && (
            <S.StyledButton $variant="danger" onClick={onEndSelected}>
              <Icon name="trash" />
              {t('listings:listings.actions.endListing')} ({selectedListingIds.length})
            </S.StyledButton>
          )}
          <S.StyledButton onClick={onRefresh} disabled={isLoading}>
            <Icon name="sync" />
            {t('translation:common.actions.refresh')}
          </S.StyledButton>
          <S.StyledButton $variant="primary" onClick={onAddListing}>
            <Icon name="add" />
            {t('listings.actions.addListing')}
          </S.StyledButton>
        </S.Actions>
      </S.Header>

      <Table
        columns={columns}
        data={listings}
        selectable
        selectedRows={selectedRows}
        onSelectionChange={(rows) => onSelectionChange(rows.map(r => r.id))}
        emptyMessage={t('listings.overview.emptyTitle')}
        pagination={pagination}
      />
    </S.Container>
  );
};
