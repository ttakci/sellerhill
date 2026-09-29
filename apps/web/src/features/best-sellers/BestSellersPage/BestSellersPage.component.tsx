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
  EmptyState,
  Icon,
  IdBadge,
  PageHeader,
  Select,
  TabNav,
  Text, type TableColumn,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BestSellersViewState } from '../bestSellers.types';

import * as S from './BestSellersPage.style';
import type { BestSellersItemView, BestSellersPageComponentProps } from './BestSellersPage.types';

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
  listTypeOptions,
  listType,
  onListTypeChange,
  categoryOptions,
  category,
  onCategoryChange,
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
  allowance,
  pagination,
}) => {
  const { t } = useTranslation(['bestSellers', 'listings', 'translation']);

  const columns: TableColumn<BestSellersItemView>[] = [
    {
      key: 'rank',
      header: t('bestSellers.table.rank'),
      align: 'right',
      width: '5rem',
      render: (_value, row) => (
        <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
          {row.rankLabel ?? EMPTY_VALUE}
        </Text>
      ),
    },
    {
      key: 'title',
      header: t('bestSellers.table.product'),
      render: (_value, row) => (
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
      render: (_value, row) => (
        <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
          {row.priceLabel ?? EMPTY_VALUE}
        </Text>
      ),
    },
    {
      key: 'ratingLabel',
      header: t('bestSellers.table.rating'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" color="text.secondary" numeric>
          {row.ratingLabel ?? t('bestSellers.noRating')}
        </Text>
      ),
    },
    {
      key: 'reviewsLabel',
      header: t('bestSellers.table.reviews'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" color="text.secondary" numeric>
          {row.reviewsLabel ?? EMPTY_VALUE}
        </Text>
      ),
    },
  ];

  const renderGridCard = (item: BestSellersItemView) => (
    <S.GridCard
      key={item.asin}
      variant="interactive"
      padding="md"
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

      <S.CardTitle variant="body-sm" weight="semibold" color="text.primary">
        {item.title}
      </S.CardTitle>

      <S.CardMetaRow>
        <Text variant="body" weight="semibold" color="text.primary" numeric>
          {item.priceLabel ?? EMPTY_VALUE}
        </Text>
        <Text variant="body-sm" color="text.secondary" numeric>
          {item.ratingLabel ?? t('bestSellers.noRating')}
        </Text>
      </S.CardMetaRow>

      <S.CardFooter onClick={onControlClick}>
        <IdBadge id={item.asin} storeType="amazon" size="sm" />
      </S.CardFooter>
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
        return (
          <EmptyState
            icon="clock"
            iconTone="warning"
            title={t('bestSellers.states.limitReached.title', {
              used: allowance?.used ?? 0,
              limit: allowance?.limit ?? 0,
            })}
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
        <>
          <S.Toolbar>
            <TabNav
              items={listTypeOptions}
              value={listType}
              onChange={onListTypeChange}
              ariaLabel={t('bestSellers.listTypesAriaLabel')}
            />

            <S.FilterRow>
              <S.CategorySelect>
                <Select
                  options={categoryOptions}
                  value={category}
                  onChange={onCategoryChange}
                  placeholder={t('bestSellers.categoryPlaceholder')}
                  isSearchable
                  searchPlaceholder={t('bestSellers.categorySearchPlaceholder')}
                  noResultsMessage={t('bestSellers.categoryNoResults')}
                  size="medium"
                  fullWidth
                />
              </S.CategorySelect>

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
                disabled={items.length === 0}
                label={t('bestSellers.selectAllOnPage')}
              />
            </S.FilterRow>

            <S.MetaRow>
              {selectedCount > 0 && (
                <Text variant="caption" weight="semibold" color="brand.primary" numeric>
                  {t('bestSellers.selected', { count: selectedCount })}
                </Text>
              )}
              {allowance && (
                <Text variant="caption" color="text.secondary" numeric>
                  {t('bestSellers.allowance', { remaining: allowance.remaining, limit: allowance.limit })}
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
            emptyContent={renderState()}
            pagination={viewState === BestSellersViewState.READY ? pagination : undefined}
          />
        </>
      )}
    </S.Container>
  );
};

BestSellersPage.displayName = 'BestSellersPage';
