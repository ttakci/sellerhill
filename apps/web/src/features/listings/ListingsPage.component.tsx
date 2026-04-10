import { Button, Checkbox, Icon, ModernSelect, PageHeader, Table, TablePagination } from '@repo/ui';
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
  viewMode,
  onViewModeChange,
}) => {
  const { t } = useTranslation(['listings', 'translation']);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [bulkValue, setBulkValue] = React.useState<string | number>('');
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

  const bulkOptions = React.useMemo(
    () => [
      { value: '__placeholder__', label: t('listings.actions.bulkActions') },
      ...(bulkActions?.map((action, idx) => ({
        value: idx.toString(),
        label: action.label,
      })) || []),
    ],
    [bulkActions, t]
  );

  const handleBulkChange = (value: string | number) => {
    if (value === '__placeholder__') return;
    const actionIndex = parseInt(value as string, 10);
    if (!isNaN(actionIndex) && bulkActions?.[actionIndex]) {
      bulkActions[actionIndex].onClick(selectedRows);
    }
    setBulkValue('');
  };

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

      <S.Toolbar>
        <S.ToolbarLeft>
          {bulkActions && listings.length > 0 && viewMode === 'grid' && (
            <S.BulkSelectWrapper>
              <ModernSelect
                size="small"
                value={bulkValue}
                options={bulkOptions}
                onChange={handleBulkChange}
                placeholder={t('listings.actions.bulkActions')}
                fullWidth
              />
            </S.BulkSelectWrapper>
          )}
          <S.ToolbarGroup>
            <S.ViewToggleGroup>
              <S.ToggleButton
                $active={viewMode === 'grid'}
                onClick={() => onViewModeChange('grid')}
                title={t('translation:common.views.grid')}
              >
                <Icon name="grid-view" size={16} />
              </S.ToggleButton>
              <S.ToggleButton
                $active={viewMode === 'table'}
                onClick={() => onViewModeChange('table')}
                title={t('translation:common.views.table')}
              >
                <Icon name="format-list-bulleted" size={16} />
              </S.ToggleButton>
            </S.ViewToggleGroup>
            <S.ViewLabel variant="caption" color="text.tertiary">{t(`translation:common.views.${viewMode}`)}</S.ViewLabel>
          </S.ToolbarGroup>
        </S.ToolbarLeft>
        <S.ToolbarRight>
          <S.FilterWrapper ref={filterRef}>
            <S.IconButton variant="ghost" onClick={() => setIsFilterOpen(!isFilterOpen)} title={t('translation:common.actions.filter')}>
              <Icon name="filter-list" size={18} />
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
          <S.IconButton variant="ghost" onClick={onDownload} title={t('translation:common.actions.export')}>
            <Icon name="download" size={18} />
          </S.IconButton>
        </S.ToolbarRight>
      </S.Toolbar>

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
                      <S.CardIdLink href={`https://www.amazon.com/dp/${listing.asin}`} target="_blank" rel="noreferrer">
                        {listing.asin}
                        <Icon name="open-in-new" size={10} />
                      </S.CardIdLink>
                      {listing.ebayListingId && (
                        <>
                          <S.CardIdDivider>&#183;</S.CardIdDivider>
                          <S.CardIdLink
                            href={`https://www.ebay.com/itm/${listing.ebayListingId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {listing.ebayListingId}
                            <Icon name="open-in-new" size={10} />
                          </S.CardIdLink>
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
