import { Button, DataTable, EmptyState, InfoMessage, PageHeader, SearchField, TabNav, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CancellationDetailDrawer } from '../CancellationDetailDrawer';
import type { CancellationRowView } from '../cancellations.types';
import { CancellationCard } from '../shared/CancellationCard';

import * as S from './CancellationsPage.style';
import type { CancellationsPageProps } from './CancellationsPage.types';

export const CancellationsPageComponent: React.FC<CancellationsPageProps> = ({
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
  selectedCancellationId,
  onCloseDetail,
}) => {
  const { t } = useTranslation(['cancellations', 'translation']);

  const renderGridCard = (row: CancellationRowView) => (
    <CancellationCard key={row.id} row={row} onOpen={() => onRowOpen(row)} onKeyDown={(event) => onCardKeyDown(event, row)} />
  );

  return (
    <S.Container>
      <PageHeader title={t('cancellations.title')} subtitle={subtitle} />

      {/* Said once, plainly: open a request to see its journey and answer it;
          the answer is sent to eBay from the drawer. */}
      <InfoMessage>{t('cancellations.notice')}</InfoMessage>

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
            <S.ResultCount variant="caption" weight="medium">
              {t('cancellations.filters.resultCount', { count: resultCount })}
            </S.ResultCount>
            {hasActiveFilters && (
              <Button variant="text" size="small" onClick={onClearFilters}>
                <Text variant="body">{t('cancellations.filters.clear')}</Text>
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
