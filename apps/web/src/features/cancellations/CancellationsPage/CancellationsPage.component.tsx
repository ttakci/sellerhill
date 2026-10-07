import { Button, DataTable, EmptyState, PageHeader, SearchField, TabNav, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { CancellationDetailDrawer } from '../CancellationDetailDrawer';
import type { CancellationRowView } from '../cancellations.types';
import { CancellationCard } from '../shared/CancellationCard';

import * as S from './CancellationsPage.style';
import type { CancellationsPageProps } from './CancellationsPage.types';

export const CancellationsPageComponent: React.FC<CancellationsPageProps> = ({
  rows,
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
        <TabNav
          items={tabItems}
          value={tab}
          onChange={onTabChange}
          variant="underline"
          ariaLabel={t('cancellations.tabs.ariaLabel')}
        />
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
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSortChange={onSortChange}
        sortLabel={t('listings:listings.filters.sortLabel')}
        resultLabel={
          <Trans
            i18nKey="listings.filters.resultListed"
            ns="listings"
            values={{ count: resultCount }}
            components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
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
              action={t('cancellations.emptyFiltered.action')}
              onAction={onClearFilters}
              size="lg"
            />
          ) : (
            <EmptyState
              icon="x-circle"
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
