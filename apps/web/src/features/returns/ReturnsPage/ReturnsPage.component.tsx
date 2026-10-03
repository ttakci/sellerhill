import { Button, DataTable, EmptyState, InfoMessage, PageHeader, SearchField, TabNav, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReturnDetailDrawer } from '../ReturnDetailDrawer';
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
  onClearFilters,
  hasActiveFilters,
  resultCount,
  isInitialLoading,
  onRowOpen,
  onCardKeyDown,
  selectedReturnId,
  onCloseDetail,
}) => {
  const { t } = useTranslation(['returns', 'translation']);

  const renderGridCard = (row: ReturnRowView) => (
    <ReturnCard key={row.id} row={row} onOpen={() => onRowOpen(row)} onKeyDown={(event) => onCardKeyDown(event, row)} />
  );

  return (
    <S.Container>
      <PageHeader title={t('returns.title')} subtitle={subtitle} />

      {/* Said once, plainly: open a return to see its history and act on it;
          what the app cannot do itself is answered on eBay. */}
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
              size="small"
              fullWidth
            />
          </S.SearchWrapper>
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

      <ReturnDetailDrawer returnId={selectedReturnId} onClose={onCloseDetail} />
    </S.Container>
  );
};
