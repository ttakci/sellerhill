import { Button, DataTable, EmptyState, PageHeader, SearchField, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { CancellationDetailDrawer } from '../CancellationDetailDrawer';
import type { CancellationRowView } from '../cancellations.types';
import { CancellationCard } from '../shared/CancellationCard';

import * as S from './CancellationsPage.style';
import type { CancellationsPageProps } from './CancellationsPage.types';

import { StatusLegend } from '@/components/StatusLegend';
import { StatusTabs, type StatusTabColor } from '@/components/StatusTabs';

/**
 * One colour per `CancellationTab`, in order — the Orders rail's own colours
 * for the same meanings: all blue · needs action red · in progress blue · closed green.
 */
const TAB_COLORS: readonly StatusTabColor[] = [
  'colors.brand.primary',
  'colors.semantic.error',
  'colors.semantic.info',
  'colors.semantic.success',
];

export const CancellationsPageComponent: React.FC<CancellationsPageProps> = ({
  rows,
  onDownload,
  columns,
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
  pagination,
  tab,
  tabItems,
  legendRows,
  onTabChange,
  search,
  onSearchChange,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  isInitialLoading,
  onRowOpen,
  selectedCancellationId,
  onCloseDetail,
}) => {
  const { t } = useTranslation(['cancellations', 'listings', 'translation']);

  const renderGridCard = (row: CancellationRowView) => (
    <CancellationCard key={row.id} row={row} onOpen={() => onRowOpen(row)} />
  );

  return (
    <S.Container>
      {/* The subtitle says what this screen is for, like every list page. */}
      <PageHeader title={t('cancellations.title')} subtitle={t('cancellations.subtitle')} />

      <S.TabsRow>
        <StatusTabs
          $colors={TAB_COLORS}
          items={tabItems}
          value={tab}
          onChange={onTabChange}
          variant="underline"
          ariaLabel={t('cancellations.tabs.ariaLabel')}
        />
        <StatusLegend rows={legendRows} />
      </S.TabsRow>

      <S.FilterBar>
        <S.FilterBarRow>
          <S.SearchWrapper>
            <SearchField
              value={search}
              onChange={onSearchChange}
              placeholder={t('cancellations.filters.search')}
              aria-label={t('cancellations.filters.search')}
              size="small"
              fullWidth
            />
          </S.SearchWrapper>
          <S.FilterActions>
            {hasActiveFilters && (
              <Button variant="text" size="small" onClick={onClearFilters}>
                <Text variant="body">{t('cancellations.filters.clear')}</Text>
              </Button>
            )}
          </S.FilterActions>
        </S.FilterBarRow>
      </S.FilterBar>

      <DataTable
        onDownload={rows.length > 0 ? onDownload : undefined}
        downloadLabel={t('listings:listings.actions.export')}
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSortChange={onSortChange}
        sortLabel={t('listings:listings.filters.sortLabel')}
        resultLabel={
          <Trans
            i18nKey="listings.filters.resultListed"
            ns="listings"
            values={{ count: resultCount }}
            components={{
              b: (
                <Text variant="body-sm" weight="bold" color="text.primary">
                  {null}
                </Text>
              ),
            }}
          />
        }
        gridMinItemWidth="26rem"
        gridMaxColumns={2}
        columns={columns}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={onToggleColumn}
        onMoveColumn={onMoveColumn}
        columnManagerLabel={t('listings:listings.table.columns')}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        defaultViewMode="grid"
        data={rows}
        renderGridCard={renderGridCard}
        emptyContent={
          hasActiveFilters ? (
            <EmptyState
              icon="search"
              title={t('cancellations.emptyFiltered.title')}
              description={t('cancellations.emptyFiltered.description')}
              actionIcon="x"
              action={t('cancellations.emptyFiltered.action')}
              onAction={onClearFilters}
              size="lg"
            />
          ) : (
            <EmptyState
              icon="package-x"
              title={t('cancellations.empty.title')}
              description={t('cancellations.empty.description')}
              size="lg"
            />
          )
        }
        loading={isInitialLoading}
        pagination={pagination}
        onRowClick={onRowOpen}
      />

      <CancellationDetailDrawer cancellationId={selectedCancellationId} onClose={onCloseDetail} />
    </S.Container>
  );
};
