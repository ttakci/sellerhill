import { Checkbox, Icon, Table, TablePagination } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ListingsPage.style';
import { ListingsPageProps } from './ListingsPage.types';

export const ListingsPageComponent: React.FC<ListingsPageProps> = ({
  listings,
  isLoading,
  onRefresh,
  onAddListing,
  onEndListings,
  selectedListingIds,
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
  viewMode,
  onViewModeChange,
}) => {
  const { t } = useTranslation(['listings', 'translation']);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const filterRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filterAction = (
    <S.FilterWrapper ref={filterRef}>
      <S.IconButton onClick={() => setIsFilterOpen(!isFilterOpen)} title={t('translation:common.actions.filter')}>
        <Icon name="filter-list" size={20} />
      </S.IconButton>
      {isFilterOpen && (
        <S.PopoverContainer>
          <S.PopoverHeader>{t('translation:common.actions.filter')}</S.PopoverHeader>
          <S.PopoverContent>
            {columnOptions.map((opt) => (
              <Checkbox
                key={opt.key}
                label={opt.label}
                checked={visibleColumnKeys.includes(opt.key)}
                onChange={() => onToggleColumn(opt.key)}
                disabled={opt.alwaysVisible}
              />
            ))}
          </S.PopoverContent>
        </S.PopoverContainer>
      )}
    </S.FilterWrapper>
  );

  const viewToggle = (
    <S.ToolbarGroup>
      <S.ViewToggleGroup>
        <S.ToggleButton
          $active={viewMode === 'grid'}
          onClick={() => onViewModeChange('grid')}
          title={t('translation:common.views.grid')}
        >
          <Icon name="grid-view" size={20} />
        </S.ToggleButton>
        <S.ToggleButton
          $active={viewMode === 'table'}
          onClick={() => onViewModeChange('table')}
          title={t('translation:common.views.table')}
        >
          <Icon name="format-list-bulleted" size={20} />
        </S.ToggleButton>
      </S.ViewToggleGroup>
      <S.ViewLabel>
        {t('translation:common.views.label')}: <strong>{t(`translation:common.views.${viewMode}`)}</strong>
      </S.ViewLabel>
    </S.ToolbarGroup>
  );

  return (
    <S.Container>
      <S.Header>
        <S.HeaderContent>
          <S.PageTitle>{t('listings.overview.title')}</S.PageTitle>
          <S.PageSubtitle>{t('listings.overview.subtitle', { count: listings.length })}</S.PageSubtitle>
        </S.HeaderContent>
        <S.Actions>
          <S.StyledButton onClick={onRefresh} disabled={isLoading}>
            <Icon name="sync" />
            {t('translation:common.actions.refresh')}
          </S.StyledButton>
          <S.StyledButton $variant="primary" onClick={onAddListing}>
            <Icon name="add" />
            {t('listings.actions.addListing')}
          </S.StyledButton>
        </S.Actions>
      </S.Header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Bulk actions and search could go here if extracted from Table */}
          {bulkActions && listings.length > 0 && viewMode === 'grid' && (
            <select
              style={{
                padding: '0.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #e2e8f0',
                fontSize: '0.875rem',
              }}
              onChange={(e) => {
                const action = bulkActions.find((a) => a.label === e.target.value);
                if (action) action.onClick(selectedRows);
              }}
              value=""
            >
              <option value="" disabled>
                {t('listings.actions.bulkActions')}
              </option>
              {bulkActions.map((action) => (
                <option key={action.label} value={action.label}>
                  {action.label}
                </option>
              ))}
            </select>
          )}
          {viewToggle}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {filterAction}
          <S.IconButton onClick={onDownload} title={t('translation:common.actions.export')}>
            <Icon name="download" size={20} />
          </S.IconButton>
        </div>
      </div>

      {viewMode === 'table' ? (
        <Table
          columns={columns}
          data={listings}
          selectable
          selectedRows={selectedRows}
          onSelectionChange={(rows) => onSelectionChange(rows.map((r) => r.id))}
          emptyMessage={t('listings.overview.emptyTitle')}
          bulkActions={bulkActions}
          bulkActionsPlaceholder={t('listings.actions.bulkActions')}
          onDownload={onDownload}
          actions={filterAction}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
          pagination={pagination}
        />
      ) : (
        <>
          <S.GridContainer>
            {listings.map((listing) => (
              <S.ListingCard key={listing.id} variant="bordered">
                <S.CardImageSection>
                  {listing.imageUrls?.[0] ? (
                    <S.ProductImage src={listing.imageUrls[0]} alt={listing.title} />
                  ) : (
                    <Icon name="image" size={48} />
                  )}
                  <S.CardStatusBadge>
                    <S.StatusBadge $status={listing.status}>
                      {t(`listings.status.${listing.status.toLowerCase()}`)}
                    </S.StatusBadge>
                  </S.CardStatusBadge>
                </S.CardImageSection>

                <S.CardBody>
                  <S.CardTitle href="#">
                    {listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title}
                  </S.CardTitle>

                  <S.CardMetaList>
                    <S.MetaBadge>
                      {t('listings.table.asin')}: {listing.asin}
                    </S.MetaBadge>
                    {listing.ebayListingId && (
                      <S.MetaBadge>
                        {t('listings.table.ebayId')}: {listing.ebayListingId}
                      </S.MetaBadge>
                    )}
                  </S.CardMetaList>

                  <S.CardStatsRow>
                    <S.StatItem>
                      <S.StatLabel>{t('listings.table.price')}</S.StatLabel>
                      <S.StatValue>${listing.price.toFixed(2)}</S.StatValue>
                    </S.StatItem>
                    <S.StatItem>
                      <S.StatLabel>{t('listings.table.estimatedProfit')}</S.StatLabel>
                      <S.StatValue $type="profit">
                        {(listing.estimatedProfit ?? 0) >= 0 ? '+' : ''}${(listing.estimatedProfit ?? 0).toFixed(2)}
                      </S.StatValue>
                    </S.StatItem>
                    <S.StatItem>
                      <S.StatLabel>{t('listings.table.roi')}</S.StatLabel>
                      <S.StatValue $type="roi">{listing.roi?.toFixed(1) || '0'}%</S.StatValue>
                    </S.StatItem>
                  </S.CardStatsRow>

                  <S.CardFooter>
                    <S.StockInfo>
                      <Icon name="inventory-2" size={18} />
                      <span>
                        {t('listings:card.stock')}: <span className="count">{listing.quantity}</span>
                      </span>
                    </S.StockInfo>
                    <S.UpdateTime>{t('listings:card.updated', { time: '-' })}</S.UpdateTime>
                  </S.CardFooter>
                </S.CardBody>

                <S.CardActions>
                  <S.QuickActions>
                    <S.IconButton title={t('listings:card.editListing')}>
                      <Icon name="edit" size={20} />
                    </S.IconButton>
                    <S.IconButton title={t('listings:card.deleteListing')}>
                      <Icon name="delete" size={20} />
                    </S.IconButton>
                  </S.QuickActions>
                  <S.ExternalLink href={`https://www.ebay.com/itm/${listing.ebayListingId}`} target="_blank">
                    <span>{t('listings:card.ebayStore')}</span>
                    <Icon name="open-in-new" size={14} />
                  </S.ExternalLink>
                </S.CardActions>
              </S.ListingCard>
            ))}
          </S.GridContainer>

          <TablePagination
            count={pagination.count}
            page={pagination.page}
            rowsPerPage={pagination.rowsPerPage}
            onPageChange={pagination.onPageChange}
            onRowsPerPageChange={pagination.onRowsPerPageChange}
            labelRowsPerPage={t('translation:common.rowsPerPage')}
            labelInfo={t('translation:common.showing_info')}
          />
        </>
      )}
    </S.Container>
  );
};
