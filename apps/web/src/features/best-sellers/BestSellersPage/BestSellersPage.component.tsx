/**
 * BestSellersPage Component (Presentation)
 *
 * Lays out the five Amazon lists, the category picker and the ranked products.
 * Every figure arrives formatted and every state is already decided by the
 * container; this file only chooses which markup to show for it.
 */

import {
  Button,
  Checkbox,
  DataTable,
  Drawer,
  EmptyState,
  Icon,
  PageHeader,
  Select,
  Skeleton,
  TabNav,
  Text,
  TextInput,
  type TableColumn,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BestSellersViewState } from '../bestSellers.types';

import * as S from './BestSellersPage.style';
import type { BestSellersItemView, BestSellersPageComponentProps } from './BestSellersPage.types';
import { CategoryTree } from './CategoryTree';

import { ListingCard, ProductTableCell, type ListingCardMetaItem } from '@/domain-ui';

/**
 * Same grid as the eBay Listings page — the card IS the listings card, laid out
 * horizontally, so it needs the same minimum track and the same two-column cap.
 */
const GRID_MIN_ITEM_WIDTH = '24rem';
const GRID_MAX_COLUMNS = 2;

const EMPTY_VALUE = '—';

/** Placeholder cards while a list loads — enough to fill a screen, far fewer than the 50 that arrive. */
const SKELETON_CARD_COUNT = 10;

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
  ratingOptions,
  filterValues,
  onMinRatingChange,
  onMinReviewsChange,
  onPriceMinChange,
  onPriceMaxChange,
  hasActiveFilters,
  onClearFilters,
  filterResultLabel,
  selectedCount,
  isAllOnPageSelected,
  onToggleSelectAllOnPage,
  onToggleItem,
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
            meta={[{ label: t('listings:listings.table.asin'), id: row.asin, storeType: 'amazon' }]}
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

  /*
   * A locked placeholder mirrors the horizontal listings card — square image
   * slot beside title, meta and stat strip — so the grid keeps one rhythm. It
   * holds only skeleton bars (the server withheld the product), blurred, with
   * the lock disc on top, unblurred.
   */
  const renderLockedGridCard = (item: BestSellersItemView) => (
    <S.LockedCard
      key={item.asin}
      variant="elevated"
      padding="none"
      role="img"
      aria-label={t('bestSellers.locked.rowLabel')}
    >
      <S.LockedCardBody aria-hidden="true">
        <S.LockedImageSlot>
          <Skeleton width="100%" height="100%" radius="sm" />
        </S.LockedImageSlot>
        <S.LockedCardLines>
          <Skeleton width="90%" height="0.875rem" />
          <Skeleton width="65%" height="0.875rem" />
          <Skeleton width="45%" height="0.75rem" />
          <Skeleton width="55%" height="0.75rem" />
          <Skeleton width="100%" height="3rem" radius="sm" />
        </S.LockedCardLines>
      </S.LockedCardBody>
      <S.LockedOverlay>
        <S.LockedBadge>
          <Icon name="lock" size={20} color="text.secondary" />
        </S.LockedBadge>
      </S.LockedOverlay>
    </S.LockedCard>
  );

  /*
   * The eBay Listings card, fed Amazon figures: rank, review count and ASIN as
   * labelled meta rows, price and star rating in the stat strip (a third stat
   * wrapped the strip onto two lines at this card width). Clicking the card ticks
   * it (there is no detail page to open), so the "Details" arrow is hidden.
   */
  const renderGridCard = (item: BestSellersItemView) => {
    if (item.isLocked) {
      return renderLockedGridCard(item);
    }
    const meta: ListingCardMetaItem[] = [];
    if (item.rankLabel) {
      meta.push({ label: t('bestSellers.table.rank'), value: item.rankLabel });
    }
    if (item.rankChangeLabel) {
      meta.push({ label: t('bestSellers.table.rankChange'), value: item.rankChangeLabel });
    }
    if (item.reviewsLabel) {
      meta.push({ label: t('bestSellers.table.reviews'), value: item.reviewsLabel });
    }
    meta.push({ label: t('listings:listings.table.asin'), value: item.asin, storeType: 'amazon' });

    return (
      <ListingCard
        key={item.asin}
        title={item.title}
        imageUrl={item.imageUrl ?? undefined}
        meta={meta}
        stats={[
          { label: t('bestSellers.table.price'), value: item.priceLabel ?? EMPTY_VALUE },
          item.ratingValueLabel
            ? {
                label: t('bestSellers.table.rating'),
                value: item.ratingValueLabel,
                icon: 'star',
                iconColor: 'semantic.warning',
              }
            : { label: t('bestSellers.table.rating'), value: EMPTY_VALUE },
        ]}
        orientation="horizontal"
        selectable
        selected={item.isSelected}
        onSelectedChange={() => onToggleItem(item.asin)}
        selectionAriaLabel={item.title}
        onClick={() => onToggleItem(item.asin)}
      />
    );
  };

  /**
   * One `EmptyState` for every non-grid situation, so empty and each refusal
   * read as the same screen. (The first load is not one of them: it is the
   * table's own skeleton grid — see `loading` below.) It sits inside
   * the DataTable's own empty slot when the toolbar still applies (the seller
   * can switch list or category out of a refused one), and on its own card
   * when the feature is switched off altogether.
   */
  const renderState = () => {
    switch (viewState) {
      case BestSellersViewState.NO_MATCHES:
        return (
          <EmptyState
            icon="filter"
            title={t('bestSellers.states.noMatches.title')}
            description={t('bestSellers.states.noMatches.description')}
            action={t('bestSellers.filters.clear')}
            onAction={onClearFilters}
            size="lg"
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
                <S.FilterSelect>
                  <Select
                    value={filterValues.minRating}
                    onChange={onMinRatingChange}
                    options={ratingOptions}
                    placeholder={t('bestSellers.filters.anyRating')}
                    iconLeft="star"
                    size="medium"
                    fullWidth
                  />
                </S.FilterSelect>
                <S.FilterNumber>
                  <TextInput
                    name="bestSellersMinReviews"
                    value={filterValues.minReviews}
                    onChange={onMinReviewsChange}
                    placeholder={t('bestSellers.filters.minReviews')}
                    ariaLabel={t('bestSellers.filters.minReviews')}
                    iconLeft="message-circle"
                    type="number"
                    size="medium"
                    fullWidth
                  />
                </S.FilterNumber>
                <S.FilterPriceRange>
                  <TextInput
                    name="bestSellersPriceMin"
                    value={filterValues.priceMin}
                    onChange={onPriceMinChange}
                    placeholder={t('bestSellers.filters.priceMin')}
                    ariaLabel={t('bestSellers.filters.priceMin')}
                    iconLeft="circle-dollar-sign"
                    type="number"
                    size="medium"
                    fullWidth
                  />
                  <S.RangeSeparator>
                    <Text variant="body" color="text.tertiary">
                      –
                    </Text>
                  </S.RangeSeparator>
                  <TextInput
                    name="bestSellersPriceMax"
                    value={filterValues.priceMax}
                    onChange={onPriceMaxChange}
                    placeholder={t('bestSellers.filters.priceMax')}
                    ariaLabel={t('bestSellers.filters.priceMax')}
                    type="number"
                    size="medium"
                    fullWidth
                  />
                </S.FilterPriceRange>
                {hasActiveFilters && (
                  <Button variant="text" size="small" onClick={onClearFilters}>
                    <Text variant="body-sm" weight="semibold">
                      {t('bestSellers.filters.clear')}
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
                {filterResultLabel && (
                  <Text variant="caption" weight="semibold" color="text.primary" numeric>
                    {filterResultLabel}
                  </Text>
                )}
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
              loading={viewState === BestSellersViewState.LOADING}
              skeletonCount={SKELETON_CARD_COUNT}
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
