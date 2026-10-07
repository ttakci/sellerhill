import { Button, DataTable, EmptyState, PageHeader, SearchField, TabNav, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { ReturnDetailDrawer } from '../ReturnDetailDrawer';
import type { ReturnRowView } from '../returns.types';
import { ReturnCard } from '../shared/ReturnCard';

import * as S from './ReturnsPage.style';
import type { ReturnsPageProps } from './ReturnsPage.types';

export const ReturnsPageComponent: React.FC<ReturnsPageProps> = ({
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
  selectedReturnId,
  onCloseDetail,
}) => {
  const { t } = useTranslation(['returns', 'listings', 'translation']);

  const renderGridCard = (row: ReturnRowView) => (
    <ReturnCard key={row.id} row={row} onOpen={() => onRowOpen(row)} />
  );

  return (
    <S.Container>
      {/* The subtitle says what this screen is for, like every list page. */}
      <PageHeader title={t('returns.title')} subtitle={t('returns.subtitle')} />

      <S.TabsRow>
        <TabNav
          items={tabItems}
          value={tab}
          onChange={onTabChange}
          variant="underline"
          ariaLabel={t('returns.tabs.ariaLabel')}
        />
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
              title={t('returns.emptyFiltered.title')}
              description={t('returns.emptyFiltered.description')}
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
