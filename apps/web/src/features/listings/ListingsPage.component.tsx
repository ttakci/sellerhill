import { Button, DataTable, Icon, IdBadge, PageHeader } from '@repo/ui';
import React from 'react';
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
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const renderGridCard = (listing: any) => (
    <S.ListingCard key={listing.id} variant="bordered">
      <S.CardTopRow>
        <S.CardThumb>
          {listing.imageUrls?.[0] ? (
            <img src={listing.imageUrls[0]} alt={listing.title} />
          ) : (
            <Icon name="image" size={16} />
          )}
        </S.CardThumb>
        <S.CardHeaderInfo>
          <S.CardTitle>
            {listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title}
          </S.CardTitle>
          <S.CardIdLinks>
            <IdBadge id={listing.asin} storeType="amazon" size="sm" />
            {listing.ebayListingId && (
              <>
                <S.CardIdDivider>&#183;</S.CardIdDivider>
                <IdBadge id={listing.ebayListingId} storeType="ebay" size="sm" />
              </>
            )}
          </S.CardIdLinks>
        </S.CardHeaderInfo>
        <S.CardStatusBadge>
          <S.StatusBadge $status={listing.status}>
            {t(`listings.status.${listing.status.toLowerCase()}`)}
          </S.StatusBadge>
        </S.CardStatusBadge>
      </S.CardTopRow>

      <S.CardBody>
        <S.CardStatsRow>
          <S.StatItem>
            <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">{t('listings.table.price')}</S.StatLabel>
            <S.StatValue variant="body-sm" weight="bold">${listing.price.toFixed(2)}</S.StatValue>
          </S.StatItem>
          <S.StatItem>
            <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">{t('listings.table.estimatedProfit')}</S.StatLabel>
            <S.StatValue variant="body-sm" weight="bold" $type="profit">
              {(listing.estimatedProfit ?? 0) >= 0 ? '+' : ''}${(listing.estimatedProfit ?? 0).toFixed(2)}
            </S.StatValue>
          </S.StatItem>
          <S.StatItem>
            <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">{t('listings.table.roi')}</S.StatLabel>
            <S.StatValue variant="body-sm" weight="bold" $type="roi">{listing.roi?.toFixed(1) || '0'}%</S.StatValue>
          </S.StatItem>
        </S.CardStatsRow>
      </S.CardBody>

      <S.CardFooter>
        <S.StockInfo>
          <Icon name="inventory-2" size={14} />
          <span className="count">{listing.quantity}</span>
        </S.StockInfo>
      </S.CardFooter>
    </S.ListingCard>
  );

  return (
    <S.Container>
      <PageHeader
        title={t('listings.overview.title')}
        subtitle={t('listings.overview.subtitle', { count: listings.length })}
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
