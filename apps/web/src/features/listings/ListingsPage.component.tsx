import { Checkbox, Icon, Table } from '@repo/ui';
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
    </S.Container>
  );
};
