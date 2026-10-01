import { DataTable, EmptyState, Icon, PageHeader, SearchField, Select, Text, Tooltip, type TableColumn } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './RevisionHistoryPage.style';
import type { RevisionHistoryPageComponentProps, RevisionHistoryRow } from './RevisionHistoryPage.types';

import { ProductTableCell, type ProductTableCellMetaRow } from '@/domain-ui';
import { ListingRevisionsDrawer } from '@/features/listings/detail/ListingRevisionsDrawer';

/**
 * "Stock" header + an info tooltip — this is the quantity SENT TO eBay, not
 * the raw Amazon stock. Plain text (no `<Text>` wrapper) so it inherits the
 * `Th` cell's own uppercase/letter-spaced styling exactly like every other
 * column's bare-string header, instead of a `caption` variant that would
 * render at a visibly different size/weight next to its siblings.
 */
/** Column label + the "what this number is" tooltip, for both stock columns. */
const StockHeader = ({ labelKey, tooltipKey }: { labelKey: string; tooltipKey: string }): React.ReactElement => {
  const { t } = useTranslation(['listings']);
  return (
    <S.StockHeader>
      {t(labelKey)}
      <Tooltip content={t(tooltipKey)} position="top" variant="dark">
        <Icon name="info" size={12} color="text.tertiary" />
      </Tooltip>
    </S.StockHeader>
  );
};

/** `previous → new` — muted when unchanged, tinted arrow when it moved. */
const ChangeCell = ({
  previous,
  next,
  changed,
  increased,
}: {
  previous: string;
  next: string;
  changed: boolean;
  increased: boolean;
}): React.ReactElement => (
  <S.TableChange>
    {changed ? (
      <>
        <Text variant="body-sm" color="text.tertiary" numeric>
          {previous}
        </Text>
        <S.Arrow $tone={increased ? 'up' : 'down'}>
          <Icon name={increased ? 'arrow-up-right' : 'arrow-down-right'} size={13} />
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
  </S.TableChange>
);

export const RevisionHistoryPageComponent: React.FC<RevisionHistoryPageComponentProps> = ({
  rows,
  totalCount,
  isInitialLoading,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  storeFilter,
  onStoreFilterChange,
  storeOptions,
  hasActiveFilters,
  onClearFilters,
  onRowClick,
  onBack,
  drawer,
  onCloseDrawer,
  onViewListing,
  pagination,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const isEmpty = !isInitialLoading && totalCount === 0 && !hasActiveFilters;
  const isFilterEmpty = !isInitialLoading && rows.length === 0 && hasActiveFilters;
  const showChrome = !isEmpty;

  const columns: TableColumn<RevisionHistoryRow>[] = [
    {
      key: 'product',
      header: t('listings.table.product'),
      render: (_value, row) => {
        const meta: ProductTableCellMetaRow[] = [
          { label: t('listings.table.asin'), id: row.asin, storeType: 'amazon' },
        ];
        return <ProductTableCell title={row.title} imageUrl={row.imageUrl} meta={meta} subtitle={row.storeName} />;
      },
    },
    {
      key: 'price',
      header: t('listings.table.price'),
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
      header: (
        <StockHeader
          labelKey="listings.detail.revisions.sourceStockChange"
          tooltipKey="listings.detail.revisions.sourceStockTooltip"
        />
      ),
      render: (_value, row) =>
        row.newSourceStock === null ? (
          <Text variant="body-sm" color="text.tertiary">
            —
          </Text>
        ) : (
          <ChangeCell
            previous={row.previousSourceStock ?? row.newSourceStock}
            next={row.newSourceStock}
            changed={row.sourceStockChanged}
            increased={row.sourceStockIncreased}
          />
        ),
    },
    {
      key: 'quantity',
      header: (
        <StockHeader
          labelKey="listings.detail.revisions.quantityChange"
          tooltipKey="listings.detail.revisions.quantityTooltip"
        />
      ),
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
      header: t('listings.jobs.table.date'),
      render: (_value, row) => (
        <Text variant="body-sm" color="text.secondary" numeric>
          {row.recordedAt}
        </Text>
      ),
    },
  ];

  const renderGridCard = (row: RevisionHistoryRow) => {
    const meta: ProductTableCellMetaRow[] = [
      { label: t('listings.table.asin'), id: row.asin, storeType: 'amazon' },
    ];
    return (
      <S.RevisionCard key={row.id} variant="elevated" onClick={() => onRowClick(row)}>
        <ProductTableCell title={row.title} imageUrl={row.imageUrl} meta={meta} subtitle={row.storeName} />
        <S.CardChanges>
          <S.ChangeRow>
            <S.ChangeLabel>
              <Text variant="caption" color="text.tertiary">
                {t('listings.table.price')}
              </Text>
            </S.ChangeLabel>
            <S.ChangeValues>
              <ChangeCell
                previous={row.previousPrice}
                next={row.newPrice}
                changed={row.priceChanged}
                increased={row.priceIncreased}
              />
            </S.ChangeValues>
          </S.ChangeRow>
          {row.newSourceStock !== null && (
            <S.ChangeRow>
              <S.ChangeLabel>
                <S.CardLabelRow>
                  <Text variant="caption" color="text.tertiary">
                    {t('listings.detail.revisions.sourceStockChange')}
                  </Text>
                  <Tooltip content={t('listings.detail.revisions.sourceStockTooltip')} position="top" variant="dark">
                    <Icon name="info" size={12} color="text.tertiary" />
                  </Tooltip>
                </S.CardLabelRow>
              </S.ChangeLabel>
              <S.ChangeValues>
                <ChangeCell
                  previous={row.previousSourceStock ?? row.newSourceStock}
                  next={row.newSourceStock}
                  changed={row.sourceStockChanged}
                  increased={row.sourceStockIncreased}
                />
              </S.ChangeValues>
            </S.ChangeRow>
          )}
          <S.ChangeRow>
            <S.ChangeLabel>
              <S.CardLabelRow>
                <Text variant="caption" color="text.tertiary">
                  {t('listings.detail.revisions.quantityChange')}
                </Text>
                <Tooltip content={t('listings.detail.revisions.quantityTooltip')} position="top" variant="dark">
                  <Icon name="info" size={12} color="text.tertiary" />
                </Tooltip>
              </S.CardLabelRow>
            </S.ChangeLabel>
            <S.ChangeValues>
              <ChangeCell
                previous={row.previousQuantity}
                next={row.newQuantity}
                changed={row.quantityChanged}
                increased={row.quantityIncreased}
              />
            </S.ChangeValues>
          </S.ChangeRow>
        </S.CardChanges>
        <S.CardFooter>
          <Text variant="caption" color="text.tertiary" numeric>
            {row.recordedAt}
          </Text>
        </S.CardFooter>
      </S.RevisionCard>
    );
  };

  const emptyState = (() => {
    if (isInitialLoading) {
      return (
        <EmptyState
          icon="loader"
          title={t('translation:common.loading')}
          description={t('listings.revisionHistory.subtitle')}
          size="md"
        />
      );
    }
    if (isFilterEmpty) {
      return (
        <EmptyState
          icon="search"
          title={t('listings.empty.filtersTitle')}
          description={t('listings.empty.filtersSubtitle')}
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
                  size="medium"
                  fullWidth
                />
              </S.SearchWrapper>
              <S.SelectWrapper>
                <Select
                  value={storeFilter}
                  onChange={onStoreFilterChange}
                  options={storeOptions}
                  placeholder={t('listings.filters.allStores')}
                  size="medium"
                  fullWidth
                />
              </S.SelectWrapper>
              <S.FilterActions>
                <S.ResultCount variant="caption" weight="medium" color="text.secondary">
                  {t('listings.filters.resultCount', { count: pagination.count })}
                </S.ResultCount>
              </S.FilterActions>
            </S.FilterBarRow>
          </S.FilterBar>
        </S.FilterBarWrapper>
      )}

      <DataTable
        gridMinItemWidth="20rem"
        columns={columns}
        data={rows}
        renderGridCard={renderGridCard}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        defaultViewMode="grid"
        hideViewToggle={isEmpty || isInitialLoading}
        emptyContent={emptyState}
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
