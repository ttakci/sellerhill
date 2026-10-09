import { Button, DataTable, EmptyState, PageHeader, SearchField, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ReturnDetailDrawer } from '../ReturnDetailDrawer';
import type { ReturnRowView } from '../returns.types';
import { ReturnCard } from '../shared/ReturnCard';

import * as S from './ReturnsPage.style';
import type { ReturnsPageProps } from './ReturnsPage.types';

import { StatusLegend } from '@/components/StatusLegend';
import { StatusTabs, type StatusTabColor } from '@/components/StatusTabs';

/**
 * One colour per `ReturnTab`, in order — the Orders rail's own colours for the
 * same meanings: all blue · needs action red · in progress blue · closed green.
 */
const TAB_COLORS: readonly StatusTabColor[] = [
  'colors.brand.primary',
  'colors.semantic.error',
  'colors.semantic.info',
  'colors.semantic.success',
];

export const ReturnsPageComponent: React.FC<ReturnsPageProps> = ({
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
  selectedReturnId,
  onCloseDetail,
}) => {
  const { t } = useTranslation(['returns', 'listings', 'translation']);

  const renderGridCard = (row: ReturnRowView) => <ReturnCard key={row.id} row={row} onOpen={() => onRowOpen(row)} />;

  return (
    <S.Container>
      {/* The subtitle says what this screen is for, like every list page. */}
      <PageHeader title={t('returns.title')} subtitle={t('returns.subtitle')} />

      <S.TabsRow>
        <StatusTabs
          $colors={TAB_COLORS}
          items={tabItems}
          value={tab}
          onChange={onTabChange}
          variant="underline"
          ariaLabel={t('returns.tabs.ariaLabel')}
        />
        <StatusLegend rows={legendRows} />
      </S.TabsRow>

      <S.FilterBar>
        <S.FilterBarRow>
          <S.SearchWrapper>
            <SearchField
              value={search}
              onChange={onSearchChange}
              placeholder={t('returns.filters.search')}
              aria-label={t('returns.filters.search')}
              size="small"
              fullWidth
            />
          </S.SearchWrapper>
          <S.FilterActions>
            {hasActiveFilters && (
              <Button variant="text" size="small" onClick={onClearFilters}>
                <Text variant="body">{t('returns.filters.clear')}</Text>
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
              title={t('returns.emptyFiltered.title')}
              description={t('returns.emptyFiltered.description')}
              actionIcon="x"
              action={t('returns.emptyFiltered.action')}
              onAction={onClearFilters}
              size="lg"
            />
          ) : (
            <EmptyState
              icon="undo-2"
              title={t('returns.empty.title')}
              description={t('returns.empty.description')}
              size="lg"
            />
          )
        }
        loading={isInitialLoading}
        pagination={pagination}
        onRowClick={onRowOpen}
      />

      <ReturnDetailDrawer returnId={selectedReturnId} onClose={onCloseDetail} />
    </S.Container>
  );
};
