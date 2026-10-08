import type { ListingDto } from '@repo/shared';
import {
  Badge,
  Button,
  DataTable,
  DatePicker,
  EmptyState,
  Icon,
  PageHeader,
  SearchField,
  Select,
  Text,
  TextInput,
} from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';


import { toListingCardProps } from '../shared/listing-card.mapper';

import * as S from './ListingsAllPage.style';
import type { ListingsAllPageProps } from './ListingsAllPage.types';

import { ListingCard } from '@/domain-ui';

export const ListingsAllPageComponent: React.FC<ListingsAllPageProps> = ({
  listings,
  locale,
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
  onMoveColumn,
  sortOptions,
  sortValue,
  onSortChange,
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
  numericFilters,
  dateFilters,
  activeFilterChips,
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
    const card = toListingCardProps(listing, t, locale);
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
          actionIcon="x"
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
        actionIcon="plus"
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
                  size="small"
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
                  size="small"
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
                    size="small"
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
                  size="small"
                  fullWidth
                />
              </S.SelectWrapper>
              <S.FilterActions>
                {hasActiveFilters && (
                  <Button variant="text" size="small" onClick={onClearFilters}>
                    <Text variant="body">{t('listings.filters.clearAll')}</Text>
                  </Button>
                )}
              </S.FilterActions>
            </S.FilterBarRow>

            {activeFilterChips.length > 0 && (
              <S.ChipRow>
                {activeFilterChips.map((chip) => (
                  <Badge key={chip.key} variant="primary" size="md">
                    <S.ChipInner>
                      <Text variant="body-sm" weight="semibold" color="brand.primary">
                        {chip.label}
                      </Text>
                      <S.ChipRemove
                        type="button"
                        variant="ghost"
                        onClick={chip.onRemove}
                        aria-label={t('listings.filters.removeFilter', { label: chip.label })}
                      >
                        <Icon name="x" size={14} color="brand.primary" />
                      </S.ChipRemove>
                    </S.ChipInner>
                  </Badge>
                ))}
              </S.ChipRow>
            )}

            <S.AdvancedDivider />
            <S.AdvancedHeaderRow>
              <Button variant="text" size="small" onClick={onToggleAdvanced}>
                <Icon name="sliders-horizontal" size={16} color="brand.primary" />
                <Text variant="body-sm" weight="semibold" color="brand.primary">
                  {t('listings.filters.advancedFilters')}
                </Text>
                <S.AdvancedChevron $isOpen={advancedOpen}>
                  <Icon name="chevron-down" size={16} color="brand.primary" />
                </S.AdvancedChevron>
              </Button>
            </S.AdvancedHeaderRow>

            {advancedOpen && (
              <S.NumericFilterGrid>
                <S.NumericFilterField>
                  <S.NumericRangeRow>
                    {dateFilters.map((field, index) => (
                      <React.Fragment key={field.key}>
                        {index > 0 && (
                          <S.RangeSeparator variant="body" color="text.tertiary">
                            –
                          </S.RangeSeparator>
                        )}
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          label={field.label}
                          clearLabel={field.clearLabel}
                          locale={locale}
                          size="medium"
                          fullWidth
                        />
                      </React.Fragment>
                    ))}
                  </S.NumericRangeRow>
                </S.NumericFilterField>
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
                    {field.note && (
                      <Text variant="caption" color="text.secondary">
                        {field.note}
                      </Text>
                    )}
                  </S.NumericFilterField>
                ))}
              </S.NumericFilterGrid>
            )}
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
            values={{ count: resultCount }}
            components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
          />
        }
        gridMinItemWidth="27rem"
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
        onMoveColumn={onMoveColumn}
        columnManagerLabel={t('listings.table.columns')}
        downloadLabel={t('listings.actions.export')}
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
