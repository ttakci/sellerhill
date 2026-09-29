/**
 * BestSellersPage Component (Presentation)
 *
 * Lays out the five Amazon lists, the category picker and the ranked products.
 * Every figure arrives formatted and every state is already decided by the
 * container; this file only chooses which markup to show for it.
 */

import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Drawer,
  EmptyState,
  Icon,
  IdBadge,
  PageHeader,
  Skeleton,
  TabNav,
  Text, type TableColumn,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BestSellersViewState } from '../bestSellers.types';

import * as S from './BestSellersPage.style';
import type { BestSellersItemView, BestSellersPageComponentProps } from './BestSellersPage.types';
import { CategoryTree } from './CategoryTree';

import { ProductTableCell } from '@/domain-ui';

/** Amazon renders 100 products as two pages of 50; four columns keeps a page to ~13 rows. */
const GRID_MIN_ITEM_WIDTH = '17rem';
const GRID_MAX_COLUMNS = 4;

const EMPTY_VALUE = '—';

export const BestSellersPage: React.FC<BestSellersPageComponentProps> = ({
  viewState,
  items,
  selectedRows,
  onSelectionChange,
  isRowSelectable,
  hasSelectableItems,
  lockedCount,
  onUpgrade,
  listTypeOptions,
  listType,
  onListTypeChange,
  categoryTreeRows,
  categorySearchValue,
  onCategorySearchChange,
  onCategorySelect,
  onToggleCategoryExpand,
  hasDepartments,
  activeCategoryLabel,
  isCategoryDrawerOpen,
  onOpenCategoryDrawer,
  onCloseCategoryDrawer,
  isSubCategory,
  onBackToAllCategories,
  selectedCount,
  isAllOnPageSelected,
  onToggleSelectAllOnPage,
  onToggleItem,
  onControlClick,
  onListSelected,
  onClearSelection,
  onRetry,
  allowanceLabel,
  pagination,
}) => {
  const { t } = useTranslation(['bestSellers', 'listings', 'translation']);

  /*
   * A locked row holds no data (the server withheld the product), so every
   * cell of it is a blurred skeleton bar — the product cell additionally
   * carries the lock glyph, unblurred, so the row reads as "locked" rather
   * than "still loading".
   */
  const renderLockedCell = (align: 'left' | 'center' | 'right', width: string) => (
    <S.LockedCell $align={align} aria-hidden="true">
      <Skeleton width={width} height="0.875rem" />
    </S.LockedCell>
  );

  const columns: TableColumn<BestSellersItemView>[] = [
    {
      key: 'rank',
      header: t('bestSellers.table.rank'),
      align: 'right',
      width: '5rem',
      render: (_value, row) =>
        row.isLocked ? (
          renderLockedCell('right', '2rem')
        ) : (
          <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
            {row.rankLabel ?? EMPTY_VALUE}
          </Text>
        ),
    },
    {
      key: 'title',
      header: t('bestSellers.table.product'),
      render: (_value, row) =>
        row.isLocked ? (
          <S.LockedProductCell role="img" aria-label={t('bestSellers.locked.rowLabel')}>
            <Icon name="lock" size={18} color="text.tertiary" />
            <S.LockedLines aria-hidden="true">
              <Skeleton width="70%" height="0.875rem" />
              <Skeleton width="40%" height="0.75rem" />
            </S.LockedLines>
          </S.LockedProductCell>
        ) : (
          <ProductTableCell
            title={row.title}
            imageUrl={row.imageUrl ?? undefined}
            meta={[{ label: t('listings:listings.table.asin'), id: row.asin, storeType: 'amazon', icon: 'barcode' }]}
          />
        ),
    },
    {
      key: 'priceLabel',
      header: t('bestSellers.table.price'),
      align: 'right',
      render: (_value, row) =>
        row.isLocked ? (
          renderLockedCell('right', '3.5rem')
        ) : (
          <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
            {row.priceLabel ?? EMPTY_VALUE}
          </Text>
        ),
    },
    {
      key: 'ratingLabel',
      header: t('bestSellers.table.rating'),
      align: 'right',
      render: (_value, row) =>
        row.isLocked ? (
          renderLockedCell('right', '4.5rem')
        ) : (
          <Text variant="body-sm" color="text.secondary" numeric>
            {row.ratingLabel ?? t('bestSellers.noRating')}
          </Text>
        ),
    },
    {
      key: 'reviewsLabel',
      header: t('bestSellers.table.reviews'),
      align: 'right',
      render: (_value, row) =>
        row.isLocked ? (
          renderLockedCell('right', '3rem')
        ) : (
          <Text variant="body-sm" color="text.secondary" numeric>
            {row.reviewsLabel ?? EMPTY_VALUE}
          </Text>
        ),
    },
  ];

  const renderLockedGridCard = (item: BestSellersItemView) => (
    <S.LockedCard
      key={item.asin}
      variant="bordered"
      padding="none"
      role="img"
      aria-label={t('bestSellers.locked.rowLabel')}
    >
      <S.LockedCardBody aria-hidden="true">
        <S.CardTopRow>
          <Skeleton width="2.5rem" height="1.25rem" radius="full" />
          <Skeleton width="1.125rem" height="1.125rem" radius="sm" />
        </S.CardTopRow>
        <S.CardImageFrame>
          <Skeleton width="60%" height="80%" radius="md" />
        </S.CardImageFrame>
        <S.CardBody>
          <Skeleton width="90%" height="0.875rem" />
          <Skeleton width="60%" height="0.875rem" />
          <S.CardMetaRow>
            <Skeleton width="30%" height="1rem" />
            <Skeleton width="35%" height="0.75rem" />
          </S.CardMetaRow>
          <Skeleton width="45%" height="1.25rem" radius="sm" />
        </S.CardBody>
      </S.LockedCardBody>
      <S.LockedOverlay>
        <S.LockedBadge>
          <Icon name="lock" size={20} color="text.secondary" />
        </S.LockedBadge>
      </S.LockedOverlay>
    </S.LockedCard>
  );

  const renderGridCard = (item: BestSellersItemView) =>
    item.isLocked ? (
      renderLockedGridCard(item)
    ) : (
      <S.GridCard
        key={item.asin}
        variant="interactive"
        padding="none"
        aria-pressed={item.isSelected}
        onClick={() => onToggleItem(item.asin)}
      >
        <S.CardTopRow>
          {item.rankLabel ? (
            <Badge variant={item.isSelected ? 'primary' : 'neutral'} size="sm" isPill>
              {item.rankLabel}
            </Badge>
          ) : (
            <span />
          )}
          <S.CardControl onClick={onControlClick}>
            <Checkbox checked={item.isSelected} onChange={() => onToggleItem(item.asin)} aria-label={item.title} />
          </S.CardControl>
        </S.CardTopRow>

        <S.CardImageFrame>
          {item.imageUrl ? (
            <S.CardImage src={item.imageUrl} alt={item.title} loading="lazy" />
          ) : (
            <Icon name="image" size={40} color="text.tertiary" />
          )}
        </S.CardImageFrame>

        <S.CardBody>
          <S.CardTitleClamp title={item.title}>
            <Text variant="body" weight="semibold" color="text.primary">
              {item.title}
            </Text>
          </S.CardTitleClamp>

          <S.CardMetaRow>
            <Text variant="body" weight="bold" color="text.primary" numeric>
              {item.priceLabel ?? EMPTY_VALUE}
            </Text>
            <Text variant="body-sm" color="text.secondary" numeric>
              {item.ratingLabel ?? t('bestSellers.noRating')}
            </Text>
          </S.CardMetaRow>

          <S.CardFooter onClick={onControlClick}>
            <IdBadge id={item.asin} storeType="amazon" size="sm" />
          </S.CardFooter>
        </S.CardBody>
      </S.GridCard>
    );

  /**
   * One `EmptyState` for every non-grid situation, first load included, so
   * loading, empty and each refusal read as the same screen. It sits inside
   * the DataTable's own empty slot when the toolbar still applies (the seller
   * can switch list or category out of a refused one), and on its own card
   * when the feature is switched off altogether.
   */
  const renderState = () => {
    switch (viewState) {
      case BestSellersViewState.LOADING:
        return (
          <EmptyState
            icon="loader"
            title={t('bestSellers.states.loading.title')}
            description={t('bestSellers.states.loading.description')}
          />
        );
      case BestSellersViewState.NOT_FOUND:
        return (
          <EmptyState
            icon="search"
            title={t('bestSellers.states.notFound.title')}
            description={t('bestSellers.states.notFound.description')}
            action={isSubCategory ? t('bestSellers.backToAllCategories') : undefined}
            onAction={isSubCategory ? onBackToAllCategories : undefined}
            size="lg"
          />
        );
      case BestSellersViewState.BLOCKED:
        return (
          <EmptyState
            icon="clock"
            title={t('bestSellers.states.blocked.title')}
            description={t('bestSellers.states.blocked.description')}
            action={t('bestSellers.states.retry')}
            onAction={onRetry}
            size="lg"
          />
        );
      case BestSellersViewState.UNAVAILABLE:
        return (
          <EmptyState
            icon="alert-triangle"
            iconTone="warning"
            title={t('bestSellers.states.unavailable.title')}
            description={t('bestSellers.states.unavailable.description')}
            action={t('bestSellers.states.retry')}
            onAction={onRetry}
          />
        );
      case BestSellersViewState.DISABLED:
        return (
          <EmptyState
            icon="lock"
            title={t('bestSellers.states.disabled.title')}
            description={t('bestSellers.states.disabled.description')}
            size="lg"
          />
        );
      case BestSellersViewState.LIMIT_REACHED:
        // The platform's own anti-abuse brake on live fetches — generic copy,
        // no figures: a seller is not meant to plan around it.
        return (
          <EmptyState
            icon="clock"
            iconTone="warning"
            title={t('bestSellers.states.limitReached.title')}
            description={t('bestSellers.states.limitReached.description')}
          />
        );
      case BestSellersViewState.EMPTY:
      case BestSellersViewState.READY:
      default:
        return (
          <EmptyState
            icon="inbox"
            title={t('bestSellers.states.empty.title')}
            description={t('bestSellers.states.empty.description')}
            size="lg"
          />
        );
    }
  };

  const isDisabled = viewState === BestSellersViewState.DISABLED;
  const isReady = viewState === BestSellersViewState.READY;

  return (
    <S.Container>
      <PageHeader
        title={t('bestSellers.title')}
        subtitle={t('bestSellers.subtitle')}
        actions={
          isDisabled ? undefined : (
            <S.HeaderActions>
              {selectedCount > 0 && (
                <Button variant="text" size="medium" onClick={onClearSelection}>
                  <Text variant="body-sm" weight="semibold">
                    {t('bestSellers.clearSelection')}
                  </Text>
                </Button>
              )}
              <Button variant="primary" size="medium" onClick={onListSelected} disabled={selectedCount === 0}>
                <Icon name="plus" size={16} />
                <Text variant="body-sm" weight="semibold">
                  {t('bestSellers.listSelected', { count: selectedCount })}
                </Text>
              </Button>
            </S.HeaderActions>
          )
        }
      />

      {isDisabled ? (
        <S.StateCard padding="lg">{renderState()}</S.StateCard>
      ) : (
        <S.PageBody>
          <S.SidebarPanel variant="bordered" padding="lg">
            <S.SidebarHeader>
              <Icon name="grid-view" size={16} />
              <Text variant="h5">{t('bestSellers.categories.title')}</Text>
            </S.SidebarHeader>
            <CategoryTree
              rows={categoryTreeRows}
              searchValue={categorySearchValue}
              onSearchChange={onCategorySearchChange}
              onSelect={onCategorySelect}
              onToggleExpand={onToggleCategoryExpand}
              hasDepartments={hasDepartments}
            />
          </S.SidebarPanel>

          <S.ContentColumn>
            <S.MobileCategoryTrigger>
              <Button variant="secondary" size="medium" onClick={onOpenCategoryDrawer}>
                <Icon name="grid-view" size={16} />
                <S.MobileCategoryTriggerLabel>
                  <Text variant="body-sm" weight="semibold" truncate>
                    {activeCategoryLabel}
                  </Text>
                </S.MobileCategoryTriggerLabel>
                <Icon name="chevron-down" size={14} />
              </Button>
            </S.MobileCategoryTrigger>

            <S.Toolbar>
              <TabNav
                items={listTypeOptions}
                value={listType}
                onChange={onListTypeChange}
                ariaLabel={t('bestSellers.listTypesAriaLabel')}
              />

              <S.FilterRow>
                {isSubCategory && (
                  <Button variant="text" size="small" onClick={onBackToAllCategories}>
                    <Icon name="arrow-left" size={14} />
                    <Text variant="body-sm" weight="semibold">
                      {t('bestSellers.backToAllCategories')}
                    </Text>
                  </Button>
                )}

                <S.FilterSpacer />

                <Checkbox
                  checked={isAllOnPageSelected}
                  onChange={onToggleSelectAllOnPage}
                  disabled={!hasSelectableItems}
                  label={t('bestSellers.selectAllOnPage')}
                />
              </S.FilterRow>

              <S.MetaRow>
                {selectedCount > 0 && (
                  <Text variant="caption" weight="semibold" color="brand.primary" numeric>
                    {t('bestSellers.selected', { count: selectedCount })}
                  </Text>
                )}
                {allowanceLabel && (
                  <Text variant="caption" color="text.secondary" numeric>
                    {allowanceLabel}
                  </Text>
                )}
                <Text variant="caption" color="text.tertiary">
                  {t('bestSellers.allowanceHint')}
                </Text>
              </S.MetaRow>
            </S.Toolbar>

            <DataTable<BestSellersItemView>
              columns={columns}
              data={items}
              renderGridCard={renderGridCard}
              gridMinItemWidth={GRID_MIN_ITEM_WIDTH}
              gridMaxColumns={GRID_MAX_COLUMNS}
              defaultViewMode="grid"
              selectable
              selectedRows={selectedRows}
              onSelectionChange={onSelectionChange}
              isRowSelectable={isRowSelectable}
              emptyContent={renderState()}
              pagination={isReady ? pagination : undefined}
            />

            {isReady && lockedCount > 0 && (
              <S.UpsellCard variant="bordered" padding="lg">
                <EmptyState
                  icon="lock"
                  title={t('bestSellers.locked.title', { count: lockedCount })}
                  description={t('bestSellers.locked.description')}
                  action={t('bestSellers.locked.cta')}
                  onAction={onUpgrade}
                />
              </S.UpsellCard>
            )}
          </S.ContentColumn>
        </S.PageBody>
      )}

      {!isDisabled && (
        <Drawer isOpen={isCategoryDrawerOpen} onClose={onCloseCategoryDrawer} title={t('bestSellers.categories.drawerTitle')}>
          <CategoryTree
            rows={categoryTreeRows}
            searchValue={categorySearchValue}
            onSearchChange={onCategorySearchChange}
            onSelect={onCategorySelect}
            onToggleExpand={onToggleCategoryExpand}
            hasDepartments={hasDepartments}
          />
        </Drawer>
      )}
    </S.Container>
  );
};

BestSellersPage.displayName = 'BestSellersPage';
