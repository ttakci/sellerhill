import type { ListingDto } from '@repo/shared';
import { Button, DataTable, Icon, IdBadge, PageHeader, SearchField, Select, TextInput } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingsPage.style';
import { ListingsPageProps } from './ListingsPage.types';

export const ListingsPageComponent: React.FC<ListingsPageProps> = ({
  listings,
  isLoading,
  onRefresh,
  onAddListing,
  onSelectionChange,
  columns,
  selectedRows,
  bulkActions,
  onDownload,
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
  numericFilters,
  onClearFilters,
  hasActiveFilters,
  resultCount,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const renderGridCard = (listing: ListingDto) => (
    <S.ListingCard key={listing.id} variant="interactive">
      <S.CardImageSection>
        {listing.imageUrls?.[0] ? (
          <img src={listing.imageUrls[0]} alt={listing.title} />
        ) : (
          <Icon name="image" size={48} />
        )}
      </S.CardImageSection>
      <S.CardContent>
        <S.CardTitleRow>
          <S.CardTitle>
            {listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title}
          </S.CardTitle>
        </S.CardTitleRow>
        {listing.brand && <S.CardBrand>{listing.brand}</S.CardBrand>}
        <S.CardBadgeRow>
          <IdBadge id={listing.asin} storeType="amazon" size="sm" />
          {listing.ebayListingId && <IdBadge id={listing.ebayListingId} storeType="ebay" size="sm" />}
        </S.CardBadgeRow>
      </S.CardContent>
      <S.CardStatsRow>
        <S.StatItem>
          <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">
            {t('listings.table.price')}
          </S.StatLabel>
          <S.StatValue variant="body-sm" weight="bold">
            ${listing.price.toFixed(2)}
          </S.StatValue>
        </S.StatItem>
        <S.StatItem>
          <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">
            {t('listings.table.estimatedProfit')}
          </S.StatLabel>
          <S.StatValue variant="body-sm" weight="bold" $type="profit">
            {(listing.estimatedProfit ?? 0) >= 0 ? '+' : ''}${(listing.estimatedProfit ?? 0).toFixed(2)}
          </S.StatValue>
        </S.StatItem>
        <S.StatItem>
          <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">
            {t('listings.table.roi')}
          </S.StatLabel>
          <S.StatValue variant="body-sm" weight="bold" $type="roi">
            {listing.roi?.toFixed(1) || '0'}%
          </S.StatValue>
        </S.StatItem>
      </S.CardStatsRow>
      <S.CardFooter>
        <S.StockInfo>
          <S.StockLabel>
            {t('listings.table.stock')}:{' '}
            <S.StockValue $outOfStock={listing.quantity === 0}>{listing.quantity}</S.StockValue>
          </S.StockLabel>
          <S.StockLabel>
            {t('listings.table.amazonStock')}:{' '}
            <S.StockValue $outOfStock={listing.sourceStock === 0}>{listing.sourceStock ?? '—'}</S.StockValue>
          </S.StockLabel>
        </S.StockInfo>
        <S.StatusBadge $status={listing.status}>{t(`listings.status.${listing.status.toLowerCase()}`)}</S.StatusBadge>
      </S.CardFooter>
    </S.ListingCard>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('listings.overview.title')}
        subtitle={t('listings.overview.subtitle', { count: resultCount })}
        actions={
          <>
            <Button variant="secondary" onClick={onRefresh} disabled={isLoading}>
              <Icon name="sync" />
              {t('translation:common.actions.refresh')}
            </Button>
            <Button variant="primary" onClick={onAddListing}>
              <Icon name="plus" />
              {t('listings.actions.addListing')}
            </Button>
          </>
        }
      />

      <S.FilterBarWrapper>
        <S.FilterBar>
          <S.FilterBarRow>
            <S.SearchWrapper>
              <SearchField
                value={filters.search}
                onChange={onSearchChange}
                placeholder={t('listings.filters.searchPlaceholder')}
                size="medium"
              />
            </S.SearchWrapper>
            <S.SelectWrapper>
              <Select
                value={filters.category}
                onChange={onCategoryChange}
                options={categoryOptions}
                placeholder={t('listings.filters.allCategories')}
                size="small"
                fullWidth
              />
            </S.SelectWrapper>
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
            <S.FilterActions>
              <S.ResultCount variant="body-sm" color="text.tertiary">
                {t('listings.filters.resultCount', { count: resultCount })}
              </S.ResultCount>
              {hasActiveFilters && (
                <Button variant="text" size="small" onClick={onClearFilters}>
                  <Icon name="x" size={14} />
                  {t('listings.filters.clearAll')}
                </Button>
              )}
            </S.FilterActions>
          </S.FilterBarRow>

          <S.AdvancedDivider />
          <S.AdvancedHeader $isOpen={advancedOpen} onClick={() => setAdvancedOpen((v) => !v)}>
            <Icon name="sliders-horizontal" size={16} />
            {t('listings.filters.advancedFilters')}
            <Icon name="chevron-down" size={16} />
          </S.AdvancedHeader>

          {advancedOpen && (
            <S.NumericFilterGrid>
              {numericFilters.map((field) => (
                <S.NumericFilterField key={field.key}>
                  <S.NumericFilterLabel variant="caption" weight="medium" color="text.secondary">
                    {field.label}
                  </S.NumericFilterLabel>
                  <S.NumericRangeRow>
                    <TextInput
                      name={`${field.key}-min`}
                      value={field.min}
                      onChange={field.onMinChange}
                      placeholder={t('listings.filters.min')}
                      type="number"
                      size="small"
                      fullWidth
                    />
                    <S.RangeSeparator variant="body-sm" color="text.tertiary">
                      -
                    </S.RangeSeparator>
                    <TextInput
                      name={`${field.key}-max`}
                      value={field.max}
                      onChange={field.onMaxChange}
                      placeholder={t('listings.filters.max')}
                      type="number"
                      size="small"
                      fullWidth
                    />
                  </S.NumericRangeRow>
                </S.NumericFilterField>
              ))}
            </S.NumericFilterGrid>
          )}
        </S.FilterBar>
      </S.FilterBarWrapper>

      <DataTable
        columns={columns}
        data={listings}
        renderGridCard={renderGridCard}
        selectable
        selectedRows={selectedRows}
        onSelectionChange={(rows) => onSelectionChange(rows.map((r) => r.id))}
        emptyMessage={t('listings.overview.emptyTitle')}
        bulkActions={bulkActions}
        bulkActionsPlaceholder={t('listings.actions.bulkActions')}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={onToggleColumn}
        columnManagerLabel={t('translation:common.actions.filter')}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        onDownload={onDownload}
        pagination={pagination}
      />
    </S.Container>
  );
};
