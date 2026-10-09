/**
 * BestSellersPage Component (Presentation)
 *
 * The product-search page, laid out like the Orders and eBay Listings pages:
 * title → tab rail (the five Amazon lists) → filter row on the canvas → the
 * shared DataTable with its result label, sort picker, column manager, bulk
 * actions and pagination. The category tree is the one addition, as a sticky
 * column beside the results. Every figure arrives formatted and every state is
 * already decided by the container; this file only chooses the markup.
 */

import {
  Badge,
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Icon,
  PageHeader,
  SearchField,
  Select,
  Skeleton,
  Text,
  TextInput,
  Tooltip,
} from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { BestSellersViewState } from '../bestSellers.types';

import * as S from './BestSellersPage.style';
import type { BestSellersItemView, BestSellersPageComponentProps } from './BestSellersPage.types';
import { CategoryTree } from './CategoryTree';

import { ListingCard, type ListingCardMetaItem } from '@/domain-ui';

/** The eBay Listings grid: same minimum track, same two-column cap. */
const GRID_MIN_ITEM_WIDTH = '27rem';
const GRID_MAX_COLUMNS = 2;

const EMPTY_VALUE = '—';

/** Placeholder cards while a list loads — enough to fill a screen, far fewer than the 50 that arrive. */
const SKELETON_CARD_COUNT = 10;

export const BestSellersPage: React.FC<BestSellersPageComponentProps> = ({
  viewState,
  items,
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
  resultCount,
  selectedRows,
  onSelectionChange,
  isRowSelectable,
  selectedCount,
  bulkActions,
  onToggleRow,
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
  onSearchChange,
  onMinRatingChange,
  rangeFilters,
  activeFilterChips,
  advancedOpen,
  onToggleAdvanced,
  hasActiveFilters,
  onClearFilters,
  onRetry,
  allowanceLabel,
  lastFetchedLabel,
  pagination,
}) => {
  const { t } = useTranslation(['bestSellers', 'listings', 'translation']);

  /*
   * A locked placeholder mirrors the listings card — title row, 9rem image
   * beside the facts, figures row — so the grid keeps one rhythm. It holds only
   * skeleton bars (the server withheld the product), blurred, with the lock
   * disc on top, unblurred.
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
        <Skeleton width="85%" height="1rem" />
        <S.LockedCardRow>
          <S.LockedImageSlot>
            <Skeleton width="100%" height="100%" radius="sm" />
          </S.LockedImageSlot>
          <S.LockedCardLines>
            <Skeleton width="55%" height="0.75rem" />
            <Skeleton width="45%" height="0.75rem" />
            <Skeleton width="60%" height="0.75rem" />
          </S.LockedCardLines>
        </S.LockedCardRow>
        <Skeleton width="100%" height="3rem" radius="sm" />
      </S.LockedCardBody>
      <S.LockedOverlay>
        <S.LockedBadge>
          <Icon name="lock" size={20} color="text.secondary" />
        </S.LockedBadge>
      </S.LockedOverlay>
    </S.LockedCard>
  );

  /*
   * The eBay Listings card, fed Amazon figures: the rank leads the title row
   * where a listing shows its status; ASIN, price, rating, reviews (and on
   * Movers & Shakers the 24-hour rank change) are the facts beside the photo,
   * in two columns; the footer says when the list was last read from Amazon.
   * Clicking the card ticks it — there is no detail page to open, so the card
   * carries no "Details" hint.
   */
  const renderGridCard = (item: BestSellersItemView) => {
    if (item.isLocked) {
      return renderLockedGridCard(item);
    }
    const meta: ListingCardMetaItem[] = [
      { label: t('listings:listings.table.asin'), value: item.asin, storeType: 'amazon' },
      { label: t('bestSellers.table.price'), value: item.priceLabel ?? EMPTY_VALUE },
      { label: t('bestSellers.table.rating'), value: item.ratingValueLabel ?? EMPTY_VALUE, column: 'secondary' },
      { label: t('bestSellers.table.reviews'), value: item.reviewsLabel ?? EMPTY_VALUE, column: 'secondary' },
    ];
    if (item.rankChangeLabel) {
      meta.push({ label: t('bestSellers.table.rankChange'), value: item.rankChangeLabel });
    }

    return (
      <ListingCard
        key={item.asin}
        title={item.title}
        imageUrl={item.imageUrl ?? undefined}
        status={item.rankLabel ? { label: item.rankLabel, tone: 'neutral' } : undefined}
        meta={meta}
        stats={[{ label: t('bestSellers.lastFetched'), value: lastFetchedLabel ?? EMPTY_VALUE }]}
        orientation="horizontal"
        selectable
        selected={item.isSelected}
        onSelectedChange={() => onToggleRow(item)}
        selectionAriaLabel={item.title}
        onClick={() => onToggleRow(item)}
      />
    );
  };

  /**
   * One `EmptyState` for every non-grid situation, so empty and each refusal
   * read as the same screen. (The first load is not one of them: it is the
   * table's own skeleton grid — see `loading` below.) It sits inside the
   * DataTable's empty slot when the controls still apply (the seller can switch
   * list or category out of a refused one), and on its own card when the
   * feature is switched off altogether.
   */
  const renderState = () => {
    switch (viewState) {
      case BestSellersViewState.NO_MATCHES:
        return (
          <EmptyState
            icon="search"
            title={t('bestSellers.states.noMatches.title')}
            description={t('bestSellers.states.noMatches.description')}
            actionIcon="x"
            action={t('listings:listings.filters.clearAll')}
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
            actionIcon="arrow-left"
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
            actionIcon="refresh"
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
            actionIcon="refresh"
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
      <PageHeader title={t('bestSellers.title')} subtitle={t('bestSellers.subtitle')} />

      {isDisabled ? (
        <S.StateCard padding="lg">{renderState()}</S.StateCard>
      ) : (
        <>
          <S.TabsRow>
            <S.ListTabs
              items={listTypeOptions}
              value={listType}
              onChange={onListTypeChange}
              variant="underline"
              ariaLabel={t('bestSellers.listTypesAriaLabel')}
            />
            {allowanceLabel && (
              <S.Allowance>
                <Text variant="body-sm" color="text.secondary" numeric>
                  {allowanceLabel}
                </Text>
                <Tooltip content={t('bestSellers.allowanceHint')} position="bottom" variant="dark">
                  <Icon name="info" size={16} color="text.tertiary" />
                </Tooltip>
              </S.Allowance>
            )}
          </S.TabsRow>

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
              <S.FilterBlock>
                <S.FilterRow>
                  <S.MobileCategoryTrigger>
                    <Button variant="secondary" size="small" onClick={onOpenCategoryDrawer}>
                      <Icon name="grid-view" size={16} />
                      <S.MobileCategoryTriggerLabel>
                        <Text variant="body-sm" weight="semibold" truncate>
                          {activeCategoryLabel}
                        </Text>
                      </S.MobileCategoryTriggerLabel>
                      <Icon name="chevron-down" size={14} />
                    </Button>
                  </S.MobileCategoryTrigger>
                  <S.SearchWrapper>
                    <SearchField
                      value={filterValues.search}
                      onChange={onSearchChange}
                      placeholder={t('bestSellers.filters.searchPlaceholder')}
                      size="small"
                      fullWidth
                    />
                  </S.SearchWrapper>
                  <S.SelectWrapper>
                    <Select
                      value={filterValues.minRating}
                      onChange={onMinRatingChange}
                      options={ratingOptions}
                      placeholder={t('bestSellers.filters.anyRating')}
                      size="small"
                      fullWidth
                    />
                  </S.SelectWrapper>
                  <S.FilterActions>
                    {hasActiveFilters && (
                      <Button variant="text" size="small" onClick={onClearFilters}>
                        <Text variant="body-sm">{t('listings:listings.filters.clearAll')}</Text>
                      </Button>
                    )}
                  </S.FilterActions>
                </S.FilterRow>

                {activeFilterChips.length > 0 && (
                  <S.ChipRow>
                    {activeFilterChips.map((chip) => (
                      <Badge key={chip.key} variant="primary" size="md">
                        <S.ChipInner>
                          <Text variant="body-sm" weight="semibold" color="brand.primary">
                            {chip.label}
                          </Text>
                          <S.ChipRemove
                            type="button"
                            variant="ghost"
                            onClick={chip.onRemove}
                            aria-label={t('listings:listings.filters.removeFilter', { label: chip.label })}
                          >
                            <Icon name="x" size={14} color="brand.primary" />
                          </S.ChipRemove>
                        </S.ChipInner>
                      </Badge>
                    ))}
                  </S.ChipRow>
                )}

                <S.AdvancedDivider />
                <S.AdvancedHeaderRow>
                  <Button variant="text" size="small" onClick={onToggleAdvanced}>
                    <Icon name="sliders-horizontal" size={16} color="brand.primary" />
                    <Text variant="body-sm" weight="semibold" color="brand.primary">
                      {t('listings:listings.filters.advancedFilters')}
                    </Text>
                    <S.AdvancedChevron $isOpen={advancedOpen}>
                      <Icon name="chevron-down" size={16} color="brand.primary" />
                    </S.AdvancedChevron>
                  </Button>
                </S.AdvancedHeaderRow>

                {advancedOpen && (
                  <S.RangeGrid>
                    {rangeFilters.map((field) => (
                      <S.RangeRow key={field.key}>
                        <TextInput
                          name={`bestSellers-${field.key}-min`}
                          value={field.min}
                          onChange={field.onMinChange}
                          label={`${field.label} · ${t('listings:listings.filters.min')}`}
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
                          name={`bestSellers-${field.key}-max`}
                          value={field.max}
                          onChange={field.onMaxChange}
                          label={`${field.label} · ${t('listings:listings.filters.max')}`}
                          type="number"
                          size="medium"
                          fullWidth
                        />
                      </S.RangeRow>
                    ))}
                  </S.RangeGrid>
                )}
              </S.FilterBlock>

              <DataTable<BestSellersItemView>
                columns={columns}
                data={items}
                renderGridCard={renderGridCard}
                gridMinItemWidth={GRID_MIN_ITEM_WIDTH}
                gridMaxColumns={GRID_MAX_COLUMNS}
                defaultViewMode="grid"
                hideViewToggle={!isReady}
                selectable
                selectedRows={selectedRows}
                onSelectionChange={onSelectionChange}
                isRowSelectable={isRowSelectable}
                bulkActions={isReady ? bulkActions : undefined}
                bulkActionsPlaceholder={t('listings:listings.actions.bulkActions')}
                columnOptions={isReady ? columnOptions : undefined}
                visibleColumnKeys={visibleColumnKeys}
                onToggleColumn={onToggleColumn}
                onMoveColumn={onMoveColumn}
                columnManagerLabel={t('listings:listings.table.columns')}
                sortOptions={isReady ? sortOptions : undefined}
                sortValue={sortValue}
                onSortChange={onSortChange}
                sortLabel={t('listings:listings.filters.sortLabel')}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={onSort}
                resultLabel={
                  isReady ? (
                    <S.ResultLabel>
                      <Trans
                        i18nKey="listings.filters.resultListed"
                        ns="listings"
                        values={{ count: resultCount }}
                        components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
                      />
                      {selectedCount > 0 && (
                        <Text variant="body-sm" weight="semibold" color="brand.primary" numeric>
                          · {t('bestSellers.selected', { count: selectedCount })}
                        </Text>
                      )}
                    </S.ResultLabel>
                  ) : undefined
                }
                emptyContent={renderState()}
                loading={viewState === BestSellersViewState.LOADING}
                skeletonCount={SKELETON_CARD_COUNT}
                pagination={isReady ? pagination : undefined}
                onRowClick={(row) => onToggleRow(row)}
              />

              {isReady && lockedCount > 0 && (
                <S.UpsellCard variant="bordered" padding="lg">
                  <EmptyState
                    icon="lock"
                    title={t('bestSellers.locked.title', { count: lockedCount })}
                    description={t('bestSellers.locked.description')}
                    actionIcon="arrow-up-right"
                    action={t('bestSellers.locked.cta')}
                    onAction={onUpgrade}
                  />
                </S.UpsellCard>
              )}
            </S.ContentColumn>
          </S.PageBody>

          <Drawer
            isOpen={isCategoryDrawerOpen}
            onClose={onCloseCategoryDrawer}
            title={t('bestSellers.categories.drawerTitle')}
          >
            <CategoryTree
              rows={categoryTreeRows}
              searchValue={categorySearchValue}
              onSearchChange={onCategorySearchChange}
              onSelect={onCategorySelect}
              onToggleExpand={onToggleCategoryExpand}
              hasDepartments={hasDepartments}
            />
          </Drawer>
        </>
      )}
    </S.Container>
  );
};

BestSellersPage.displayName = 'BestSellersPage';
