import { ListingStatus, type ListingDto } from '@repo/shared';
import {
  Button,
  DataTable,
  Icon,
  ListingCard,
  type ListingCardProps,
  PageHeader,
  SearchField,
  Select,
  Text,
  TextInput,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingsAllPage.style';
import type { ListingsAllPageProps } from './ListingsAllPage.types';

export const ListingsAllPageComponent: React.FC<ListingsAllPageProps> = ({
  listings,
  onSelectionChange,
  columns,
  selectedRows,
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
  numericFilters,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  advancedOpen,
  onToggleAdvanced,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const renderGridCard = (listing: ListingDto) => {
    const title = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
    const profit = listing.estimatedProfit ?? 0;
    const roi = listing.roi ?? 0;
    const isActive = listing.status === ListingStatus.ACTIVE;
    const card: ListingCardProps = {
      orientation: 'vertical',
      title,
      imageUrl: listing.imageUrls?.[0],
      brand: listing.brand,
      primaryBadge: { id: listing.asin, storeType: 'amazon' },
      secondaryBadge: listing.ebayListingId ? { id: listing.ebayListingId, storeType: 'ebay' } : undefined,
      soldCount: listing.soldCount,
      watchCount: listing.watchCount,
      stats: [
        { label: t('listings.table.price'), value: `$${listing.price.toFixed(2)}` },
        {
          label: t('listings.table.estimatedProfit'),
          value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
          tone: profit >= 0 ? 'positive' : 'negative',
        },
        {
          label: t('listings.table.roi'),
          value: `${roi.toFixed(1)}%`,
          tone: roi >= 0 ? 'positive' : 'negative',
        },
      ],
      status: {
        label: t(`listings.status.${listing.status.toLowerCase()}`),
        tone: isActive ? 'active' : 'neutral',
      },
    };
    return <ListingCard key={listing.id} {...card} orientation="vertical" />;
  };

  return (
    <S.Container>
      <PageHeader
        title={t('listings.overview.title')}
        subtitle={t('listings.overview.subtitle', { count: resultCount })}
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
                  <Text>{t('listings.filters.clearAll')}</Text>
                </Button>
              )}
            </S.FilterActions>
          </S.FilterBarRow>

          <S.AdvancedDivider />
          <S.AdvancedHeader $isOpen={advancedOpen} onClick={onToggleAdvanced}>
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
        viewMode={tableView}
        onViewModeChange={onTableViewChange}
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
