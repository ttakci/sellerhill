import { Button, DataTable, EmptyState, InfoMessage, PageHeader, SearchField, Select, TabNav, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ReturnRowView } from '../returns.types';
import { ReturnCard } from '../shared/ReturnCard';

import * as S from './ReturnsPage.style';
import type { ReturnsPageProps } from './ReturnsPage.types';

export const ReturnsPageComponent: React.FC<ReturnsPageProps> = ({
  rows,
  columns,
  pagination,
  subtitle,
  tab,
  tabItems,
  onTabChange,
  search,
  onSearchChange,
  ebayAccountId,
  onEbayAccountChange,
  storeOptions,
  onClearFilters,
  hasActiveFilters,
  resultCount,
  isInitialLoading,
  onRowOpen,
  onCardKeyDown,
}) => {
  const { t } = useTranslation(['returns', 'translation']);

  const renderGridCard = (row: ReturnRowView) => (
    <ReturnCard
      key={row.id}
      row={row}
      onOpen={row.orderId ? () => onRowOpen(row) : undefined}
      onKeyDown={(event) => onCardKeyDown(event, row)}
    />
  );

  return (
    <S.Container>
      <PageHeader title={t('returns.title')} subtitle={subtitle} />

      {/* Said once, plainly: nothing on this page acts on a return. The seller
          responds on eBay; this is the queue that says where to look first. */}
      <InfoMessage>{t('returns.notice')}</InfoMessage>

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
              size="medium"
              fullWidth
            />
          </S.SearchWrapper>
          <S.SelectWrapper>
            <Select
              value={ebayAccountId}
              onChange={onEbayAccountChange}
              options={storeOptions}
              placeholder={t('returns.filters.allStores')}
              size="medium"
              fullWidth
            />
          </S.SelectWrapper>
          <S.FilterActions>
            <S.ResultCount variant="caption" weight="medium">
              {t('returns.filters.resultCount', { count: resultCount })}
            </S.ResultCount>
            {hasActiveFilters && (
              <Button variant="text" size="small" onClick={onClearFilters}>
                <Text variant="body">{t('returns.filters.clear')}</Text>
              </Button>
            )}
          </S.FilterActions>
        </S.FilterBarRow>
      </S.FilterBar>

      <DataTable
        gridMinItemWidth="26rem"
        gridMaxColumns={2}
        columns={columns}
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
    </S.Container>
  );
};
