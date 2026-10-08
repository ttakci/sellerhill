import { DataTable, EmptyState, Icon, PageHeader, SearchField, Text, type TableColumn } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { toRevisionCardProps } from './revision-card.mapper';
import * as S from './RevisionHistoryPage.style';
import type { RevisionHistoryPageComponentProps, RevisionHistoryRow } from './RevisionHistoryPage.types';

import { ListingCard, ProductTableCell, type ProductTableCellMetaRow } from '@/domain-ui';
import { ListingRevisionsDrawer } from '@/features/listings/detail/ListingRevisionsDrawer';

/** `previous → new`, right-aligned like every money/count column — muted when unchanged, tinted arrow when it moved. */
const ChangeCell = ({
  previous,
  next,
  changed,
  increased,
}: {
  previous: string | null;
  next: string | null;
  changed: boolean;
  increased: boolean;
}): React.ReactElement => {
  if (next === null) {
    return (
      <S.TableChange>
        <Text variant="body-sm" color="text.tertiary">
          —
        </Text>
      </S.TableChange>
    );
  }
  return (
    <S.TableChange>
      {changed && previous !== null ? (
        <>
          <Text variant="body-sm" color="text.tertiary" numeric>
            {previous}
          </Text>
          <S.Arrow $tone={increased ? 'up' : 'down'}>
            <Icon name={increased ? 'arrow-up-right' : 'arrow-down-right'} size={13} />
          </S.Arrow>
          <Text variant="body-sm" color="text.primary" weight="bold" numeric>
            {next}
          </Text>
        </>
      ) : (
        <Text variant="body-sm" color="text.primary" numeric>
          {next}
        </Text>
      )}
    </S.TableChange>
  );
};

export const RevisionHistoryPageComponent: React.FC<RevisionHistoryPageComponentProps> = ({
  rows,
  totalCount,
  isInitialLoading,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
  onRowClick,
  onBack,
  drawer,
  onCloseDrawer,
  onViewListing,
  visibleColumnKeys,
  columnOptions,
  onToggleColumn,
  onMoveColumn,
  sortOptions,
  sortValue,
  onSortChange,
  sortColumn,
  sortDirection,
  onSort,
  pagination,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const isEmpty = !isInitialLoading && totalCount === 0 && !hasActiveFilters;
  const isFilterEmpty = !isInitialLoading && rows.length === 0 && hasActiveFilters;
  const showChrome = !isEmpty;

  // Same shape as the listings table: a 20.5rem product cell (ASIN + eBay ID),
  // then right-aligned figures of fixed width, the date last.
  const allColumns: TableColumn<RevisionHistoryRow>[] = [
    {
      key: 'product',
      sortable: true,
      header: t('listings.table.product'),
      width: '20.5rem',
      render: (_value, row) => {
        const meta: ProductTableCellMetaRow[] = [
          { label: t('listings.table.asin'), id: row.asin, storeType: 'amazon' },
        ];
        if (row.ebayItemId) {
          meta.push({ label: t('listings.table.ebayId'), id: row.ebayItemId, storeType: 'ebay' });
        }
        return <ProductTableCell title={row.title} imageUrl={row.imageUrl} meta={meta} />;
      },
    },
    {
      key: 'sourcePrice',
      header: t('listings.detail.revisions.sourcePriceChange'),
      width: '9rem',
      align: 'right',
      render: (_value, row) => (
        <ChangeCell
          previous={row.previousSourcePrice}
          next={row.newSourcePrice}
          changed={row.sourcePriceChanged}
          increased={row.sourcePriceIncreased}
        />
      ),
    },
    {
      key: 'price',
      sortable: true,
      header: t('listings.detail.revisions.priceChange'),
      width: '9rem',
      align: 'right',
      render: (_value, row) => (
        <ChangeCell
          previous={row.previousPrice}
          next={row.newPrice}
          changed={row.priceChanged}
          increased={row.priceIncreased}
        />
      ),
    },
    {
      key: 'sourceStock',
      header: t('listings.detail.revisions.sourceStockChange'),
      width: '7.5rem',
      align: 'right',
      render: (_value, row) => (
        <ChangeCell
          previous={row.previousSourceStock}
          next={row.newSourceStock}
          changed={row.sourceStockChanged}
          increased={row.sourceStockIncreased}
        />
      ),
    },
    {
      key: 'quantity',
      header: t('listings.detail.revisions.quantityChange'),
      width: '7rem',
      align: 'right',
      render: (_value, row) => (
        <ChangeCell
          previous={row.previousQuantity}
          next={row.newQuantity}
          changed={row.quantityChanged}
          increased={row.quantityIncreased}
        />
      ),
    },
    {
      key: 'recordedAt',
      sortable: true,
      header: t('listings.jobs.table.date'),
      width: '9.5rem',
      render: (_value, row) => (
        <Text variant="body-sm" color="text.primary" numeric>
          {row.recordedAt}
        </Text>
      ),
    },
  ];
  const columns = visibleColumnKeys
    .map((key) => allColumns.find((column) => column.key === key))
    .filter((column): column is TableColumn<RevisionHistoryRow> => Boolean(column));

  // Same card as the listings page; clicking it still opens the revisions drawer.
  const renderGridCard = (row: RevisionHistoryRow) => (
    <ListingCard key={row.id} {...toRevisionCardProps(row, t)} orientation="horizontal" onClick={() => onRowClick(row)} />
  );

  const emptyState = (() => {
    if (isFilterEmpty) {
      return (
        <EmptyState
          icon="search"
          title={t('listings.empty.filtersTitle')}
          description={t('listings.empty.filtersSubtitle')}
          actionIcon="x"
          action={t('listings.empty.filtersAction')}
          onAction={onClearFilters}
          size="lg"
        />
      );
    }
    return (
      <EmptyState
        icon="history"
        title={t('listings.revisionHistory.emptyTitle')}
        description={t('listings.detail.revisions.emptySubtitle')}
        size="lg"
      />
    );
  })();

  return (
    <S.Container>
      <PageHeader
        title={t('listings.revisionHistory.title')}
        subtitle={t('listings.revisionHistory.subtitle')}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      {showChrome && (
        <S.FilterBarWrapper>
          <S.FilterBar>
            <S.FilterBarRow>
              <S.SearchWrapper>
                <SearchField
                  value={search}
                  onChange={onSearchChange}
                  placeholder={t('listings.jobs.filters.searchPlaceholder')}
                  size="small"
                  fullWidth
                />
              </S.SearchWrapper>
            </S.FilterBarRow>
          </S.FilterBar>
        </S.FilterBarWrapper>
      )}

      <DataTable
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSortChange={onSortChange}
        sortLabel={t('listings.filters.sortLabel')}
        resultLabel={
          <Trans
            i18nKey="listings.filters.resultListed"
            ns="listings"
            values={{ count: pagination.count }}
            components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
          />
        }
        gridMinItemWidth="27rem"
        gridMaxColumns={2}
        columns={columns}
        columnOptions={isEmpty ? undefined : columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={onToggleColumn}
        onMoveColumn={onMoveColumn}
        columnManagerLabel={t('listings.table.columns')}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        data={rows}
        renderGridCard={renderGridCard}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        defaultViewMode="grid"
        hideViewToggle={isEmpty || isInitialLoading}
        emptyContent={emptyState}
        loading={isInitialLoading}
        emptyMessage={t('listings.revisionHistory.empty')}
        pagination={pagination}
        onRowClick={onRowClick}
      />

      <ListingRevisionsDrawer
        isOpen={drawer.isOpen}
        onClose={onCloseDrawer}
        listingId={drawer.listingId}
        currency={drawer.currency}
        subject={drawer.subject}
        onViewListing={onViewListing}
      />
    </S.Container>
  );
};
