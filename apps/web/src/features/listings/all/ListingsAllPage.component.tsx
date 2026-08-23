import type { ListingDto } from '@repo/shared';
import {
  Button,
  DataTable,
  EmptyState,
  Icon,
  PageHeader,
  SearchField,
  Select,
  Text,
  TextInput,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';


import { toListingCardProps } from '../shared/listing-card.mapper';

import * as S from './ListingsAllPage.style';
import type { ListingsAllPageProps } from './ListingsAllPage.types';

import { ListingCard } from '@/domain-ui';

export const ListingsAllPageComponent: React.FC<ListingsAllPageProps> = ({
  listings,
  onSelectionChange,
  columns,
  selectedRows,
  selectedIds,
  onToggleListingSelection,
  bulkActions,
  onDownload,
  tableView,
  onTableViewChange,
  pagination,
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  sortColumn,
  sortDirection,
  onSort,
  filters,
  onSearchChange,
  onCategoryChange,
  categoryOptions,
  onStatusChange,
  statusOptions,
  onTrackingStateChange,
  trackingOptions,
  onEbayAccountChange,
  storeOptions,
  numericFilters,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  advancedOpen,
  onToggleAdvanced,
  onBack,
  isInitialLoading,
  onListingClick,
  isDraftMode = false,
  hideStatusFilter = false,
  onAddListing,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const pageTitle = isDraftMode ? t('listings.draftMode.pageTitle') : t('listings.overview.title');
  const pageSubtitle = isDraftMode
    ? t('listings.draftMode.pageSubtitle', { count: resultCount })
    : t('listings.overview.subtitle', { count: resultCount });

  const isEmpty = !isInitialLoading && listings.length === 0;
  /**
   * A true empty catalog/drafts view (no filters, nothing to filter) hides the
   * toolbar as noise next to EmptyState. A filtered-to-zero result must keep it —
   * otherwise a search/filter that matches nothing strands the user on a single
   * "clear all" button with no way to see or adjust what they typed.
   */
  const showListChrome = !isEmpty || hasActiveFilters;

  const renderGridCard = (listing: ListingDto) => {
    const card = toListingCardProps(listing, t);
    return (
      <ListingCard
        key={listing.id}
        {...card}
        orientation="horizontal"
        selectable
        selected={selectedIds.includes(listing.id)}
        onSelectedChange={(selected) => onToggleListingSelection(listing.id, selected)}
        selectionAriaLabel={t('listings.actions.bulkActions')}
        onClick={() => onListingClick(listing.id)}
      />
    );
  };

  const emptyState = (() => {
    if (hasActiveFilters) {
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
    if (isDraftMode) {
      return (
        <EmptyState
          icon="inventory"
          title={t('listings.empty.draftTitle')}
          description={t('listings.empty.draftSubtitle')}
          size="lg"
        />
      );
    }
    return (
      <EmptyState
        icon="inventory"
        title={t('listings.empty.catalogTitle')}
        description={t('listings.empty.catalogSubtitle')}
        action={onAddListing ? t('listings.empty.catalogAction') : undefined}
        onAction={onAddListing}
        size="lg"
      />
    );
  })();

  return (
    <S.Container>
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      {showListChrome && (
        <S.FilterBarWrapper>
          <S.FilterBar>
            <S.FilterBarRow>
              <S.SearchWrapper>
                <SearchField
                  value={filters.search}
                  onChange={onSearchChange}
                  placeholder={t('listings.filters.searchPlaceholder')}
                  size="medium"
                  fullWidth
                />
              </S.SearchWrapper>
              <S.SelectWrapper>
                {/* No floating label here — toolbar row uses compact control height to match SearchField */}
                <Select
                  value={filters.category}
                  onChange={onCategoryChange}
                  options={categoryOptions}
                  placeholder={t('listings.filters.allCategories')}
                  size="medium"
                  fullWidth
                />
              </S.SelectWrapper>
              {!hideStatusFilter && (
                <S.SelectWrapper>
                  <Select
                    value={filters.status}
                    onChange={onStatusChange}
                    options={statusOptions}
                    placeholder={t('listings.filters.allStatuses')}
                    size="medium"
                    fullWidth
                  />
                </S.SelectWrapper>
              )}
              <S.SelectWrapper>
                <Select
                  value={filters.trackingState}
                  onChange={onTrackingStateChange}
                  options={trackingOptions}
                  placeholder={t('listings.filters.allTrackingStates')}
                  size="medium"
                  fullWidth
                />
              </S.SelectWrapper>
              <S.SelectWrapper>
                <Select
                  value={filters.ebayAccountId}
                  onChange={onEbayAccountChange}
                  options={storeOptions}
                  placeholder={t('listings.filters.allStores')}
                  size="medium"
                  fullWidth
                />
              </S.SelectWrapper>
              <S.FilterActions>
                <S.ResultCount variant="caption" weight="medium" color="text.secondary">
                  {t('listings.filters.resultCount', { count: resultCount })}
                </S.ResultCount>
                {hasActiveFilters && (
                  <Button variant="text" size="small" onClick={onClearFilters}>
                    <Text variant="body">{t('listings.filters.clearAll')}</Text>
                  </Button>
                )}
              </S.FilterActions>
            </S.FilterBarRow>

            <S.AdvancedDivider />
            <S.AdvancedHeader type="button" $isOpen={advancedOpen} onClick={onToggleAdvanced}>
              <Icon name="sliders-horizontal" size={18} />
              <Text variant="body-sm" weight="semibold" color="text.primary">
                {t('listings.filters.advancedFilters')}
              </Text>
              <S.AdvancedChevron $isOpen={advancedOpen}>
                <Icon name="chevron-down" size={18} />
              </S.AdvancedChevron>
            </S.AdvancedHeader>

            {advancedOpen && (
              <S.NumericFilterGrid>
                {numericFilters.map((field) => (
                  <S.NumericFilterField key={field.key}>
                    <S.NumericRangeRow>
                      <TextInput
                        name={`${field.key}-min`}
                        value={field.min}
                        onChange={field.onMinChange}
                        label={`${field.label} · ${t('listings.filters.min')}`}
                        type="number"
                        size="medium"
                        fullWidth
                      />
                      <S.RangeSeparator variant="body" color="text.tertiary">
                        –
                      </S.RangeSeparator>
                      <TextInput
                        name={`${field.key}-max`}
                        value={field.max}
                        onChange={field.onMaxChange}
                        label={`${field.label} · ${t('listings.filters.max')}`}
                        type="number"
                        size="medium"
                        fullWidth
                      />
                    </S.NumericRangeRow>
                  </S.NumericFilterField>
                ))}
              </S.NumericFilterGrid>
            )}
          </S.FilterBar>
        </S.FilterBarWrapper>
      )}

      <DataTable
        gridMinItemWidth="24rem"
        gridMaxColumns={2}
        columns={columns}
        data={listings}
        renderGridCard={renderGridCard}
        viewMode={tableView}
        onViewModeChange={onTableViewChange}
        hideViewToggle={isEmpty}
        selectable
        selectedRows={selectedRows}
        onSelectionChange={(rows) => onSelectionChange(rows.map((r) => r.id))}
        emptyContent={emptyState}
        loading={isInitialLoading}
        bulkActions={bulkActions}
        bulkActionsPlaceholder={t('listings.actions.bulkActions')}
        columnOptions={isEmpty ? undefined : columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={onToggleColumn}
        columnManagerLabel={t('translation:common.actions.filter')}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        onDownload={isEmpty ? undefined : onDownload}
        pagination={pagination}
        onRowClick={(row) => onListingClick(row.id)}
      />
    </S.Container>
  );
};
