/**
 * BestSellersPage Container
 *
 * Owns the browse position (URL), the ticked ASINs, the fetch, and every
 * formatted figure. The API answers with codes and raw numbers; this file turns
 * them into strings and a single `viewState`, so the component only lays out.
 */

import {
  BEST_SELLERS_LIST_TYPE_ORDER,
  BEST_SELLERS_MAX_PAGE,
  BEST_SELLERS_PAGE_SIZE,
  BEST_SELLERS_ROOT_CATEGORY,
  BILLING_UNLIMITED,
  BestSellersListType,
  SourceFetchOutcome, type BestSellersBrowseAllowanceDto, type BestSellersQueryDto,
} from '@repo/shared';
import { formatCurrency, getLocaleConfig, type SelectOption, type TabNavItem } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetBestSellersQuery } from '../api/bestSellersApi';
import { BestSellersViewState, type BestSellersRefusalBody } from '../bestSellers.types';
import { useBestSellersCategoryTree } from '../hooks/useBestSellersCategoryTree';
import { useBestSellersFilters } from '../hooks/useBestSellersFilters';
import { useBestSellersSelection } from '../hooks/useBestSellersSelection';
import { useBestSellersUrlState } from '../hooks/useBestSellersUrlState';
import { flattenCategoryTree } from '../utils/bestSellersCategoryTree';
import { BEST_SELLERS_RATING_OPTIONS, matchesBestSellersFilters } from '../utils/bestSellersFilters';

import { BestSellersPage as BestSellersPageComponent } from './BestSellersPage.component';
import type { BestSellersItemView, BestSellersPagination } from './BestSellersPage.types';
import type { BestSellersCategoryTreeRow } from './CategoryTree';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { isFetchBaseQueryError } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

/** HTTP statuses the API uses for its refusals (see `BestSellersErrorKey`). */
const HTTP_UNSUPPORTED_MARKETPLACE = 400;
const HTTP_DISABLED = 404;
const HTTP_LIMIT_REACHED = 429;
const HTTP_UNAVAILABLE = 503;

/** Money keeps cents — a $19.99 list price rounded to $20 is a different price. */
const PRICE_FRACTION_DIGITS = 2;

/** Where the ticked ASINs go: the Add Listings drawer, pre-filled. */
const buildAddListingsPath = (asins: readonly string[]): string =>
  `/listings?drawer=add&asins=${encodeURIComponent(asins.join(','))}`;

/** Where a locked row's upsell goes: plans and top-up packs live on one page. */
const BILLING_PATH = '/billing';

/**
 * Synthetic key for a locked placeholder. It is not an ASIN and never reaches
 * the selection or Add Listings — `isLocked` rows are filtered out of every
 * selection callback — it only has to be unique among this page's rows.
 */
const lockedRowKey = (index: number): string => `locked-${index}`;

const isUnlocked = (row: BestSellersItemView): boolean => !row.isLocked;

export const BestSellersPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['bestSellers', 'translation']);
  const { localeNavigate } = useLocale();
  const { listType, category, page, setListType, setCategory, setPage } = useBestSellersUrlState();
  const selection = useBestSellersSelection();
  const filters = useBestSellersFilters();

  // `getLocaleConfig` carries `-u-nu-latn` for Urdu/Arabic so every figure keeps
  // Western digits — an ASIN beside an Arabic-Indic review count reads as a bug.
  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);
  const countFormat = useMemo(() => new Intl.NumberFormat(localeCfg.locale), [localeCfg]);
  const ratingFormat = useMemo(
    () => new Intl.NumberFormat(localeCfg.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [localeCfg],
  );

  // Defaults are omitted from the request too, so the URL and the cache key
  // agree: `/best-sellers` and `/best-sellers?page=1` are the same list.
  const queryArgs = useMemo<BestSellersQueryDto>(
    () => ({
      listType,
      category: category === BEST_SELLERS_ROOT_CATEGORY ? undefined : category,
      page: page > 1 ? page : undefined,
    }),
    [listType, category, page],
  );

  /*
   * `currentData` is the answer for THESE args (undefined while a new list or
   * page is loading); `data` is the last answer for any args. Items come from
   * the former so a switch shows the loading state instead of the previous
   * list under a new tab label; the allowance meter falls back to the latter
   * so it does not blink out on every page turn.
   */
  const { data, currentData, error, refetch } = useGetBestSellersQuery(queryArgs);

  /*
   * A sub-category that Amazon does not offer answers `not_found` with no
   * category tree at all — the hook keeps whatever it already cached, so the
   * tree stays browsable on that screen instead of collapsing to nothing.
   */
  const categoryTree = useBestSellersCategoryTree(listType, category, currentData?.list?.categories);

  const refusal = useMemo<{ status: number | string; body: BestSellersRefusalBody } | null>(() => {
    if (!error) {
      return null;
    }
    if (!isFetchBaseQueryError(error)) {
      return { status: 'unknown', body: {} };
    }
    const body = (error.data ?? {}) as BestSellersRefusalBody;
    return { status: error.status, body };
  }, [error]);

  /*
   * Filters run over the page already in the browser (at most 50 products).
   * What they hide was still viewed as far as the allowance goes — the server
   * counted the page when it answered.
   */
  const pageItems = useMemo(() => currentData?.list?.items ?? [], [currentData?.list?.items]);
  const filteredItems = useMemo(
    () => (filters.isActive ? pageItems.filter((item) => matchesBestSellersFilters(item, filters.criteria)) : pageItems),
    [pageItems, filters.isActive, filters.criteria],
  );

  const items = useMemo<BestSellersItemView[]>(
    () =>
      filteredItems.map((item) => {
        const average = item.rating?.average ?? null;
        const reviewCount = item.rating?.count ?? null;
        const reviewsLabel = reviewCount === null ? null : countFormat.format(reviewCount);
        const ratingLabel =
          average === null
            ? null
            : reviewsLabel === null
              ? t('bestSellers.rating', { average: ratingFormat.format(average) })
              : t('bestSellers.ratingWithReviews', { average: ratingFormat.format(average), reviews: reviewsLabel });
        return {
          asin: item.asin,
          rank: item.rank,
          rankLabel: item.rank === null ? null : t('bestSellers.rank', { rank: item.rank }),
          title: item.title ?? t('translation:common.unknownProduct'),
          imageUrl: item.image,
          priceLabel: item.price
            ? formatCurrency(item.price.amount, localeCfg.locale, item.price.currency, PRICE_FRACTION_DIGITS)
            : item.priceText,
          ratingLabel,
          ratingValueLabel: average === null ? null : ratingFormat.format(average),
          reviewsLabel,
          rankChangeLabel:
            item.rankChangePercent === null
              ? null
              : t('bestSellers.rankChange', {
                  sign: item.rankChangePercent > 0 ? '+' : '',
                  value: countFormat.format(item.rankChangePercent),
                }),
          isSelected: selection.isSelected(item.asin),
          isLocked: false,
        };
      }),
    [filteredItems, countFormat, ratingFormat, localeCfg, selection, t],
  );

  /*
   * Products the allowance did not cover were stripped server-side; the page
   * draws that many locked placeholders AFTER the visible products so the
   * seller sees the shape of what they are missing without any of its data.
   * A page can be entirely locked (allowance spent before it was opened), so
   * the placeholders count as content — never an empty state.
   */
  const lockedCount = currentData?.lockedCount ?? 0;
  const rows = useMemo<BestSellersItemView[]>(() => {
    if (lockedCount <= 0) {
      return items;
    }
    const locked: BestSellersItemView[] = Array.from({ length: lockedCount }, (_, index) => ({
      asin: lockedRowKey(index),
      rank: null,
      rankLabel: null,
      title: '',
      imageUrl: null,
      priceLabel: null,
      ratingLabel: null,
      ratingValueLabel: null,
      reviewsLabel: null,
      rankChangeLabel: null,
      isSelected: false,
      isLocked: true,
    }));
    return [...items, ...locked];
  }, [items, lockedCount]);

  const pageAsins = useMemo(() => items.map((item) => item.asin), [items]);
  const selectedRows = useMemo(() => items.filter((item) => item.isSelected), [items]);
  const isAllOnPageSelected = items.length > 0 && selectedRows.length === items.length;

  const viewState = useMemo<BestSellersViewState>(() => {
    if (refusal) {
      switch (refusal.status) {
        case HTTP_DISABLED:
          return BestSellersViewState.DISABLED;
        case HTTP_LIMIT_REACHED:
          return BestSellersViewState.LIMIT_REACHED;
        case HTTP_UNAVAILABLE:
        case HTTP_UNSUPPORTED_MARKETPLACE:
          // The web never sends a marketplace, so a 400 here is a deployment
          // mismatch rather than anything the seller did — same screen as an
          // unreachable service, never a raw error string.
          return BestSellersViewState.UNAVAILABLE;
        default:
          // A network failure or an unexpected status: retryable, and never a raw string.
          return BestSellersViewState.BLOCKED;
      }
    }
    if (!currentData) {
      return BestSellersViewState.LOADING;
    }
    switch (currentData.outcome) {
      case SourceFetchOutcome.NOT_FOUND:
        return BestSellersViewState.NOT_FOUND;
      case SourceFetchOutcome.BLOCKED:
      case SourceFetchOutcome.PARSE_FAILED:
        return BestSellersViewState.BLOCKED;
      case SourceFetchOutcome.NO_PROXY:
        return BestSellersViewState.UNAVAILABLE;
      case SourceFetchOutcome.FOUND:
      default:
        if (items.length > 0 || lockedCount > 0) {
          return BestSellersViewState.READY;
        }
        // Products arrived but every one failed a filter — say that, not "empty list".
        return pageItems.length > 0 ? BestSellersViewState.NO_MATCHES : BestSellersViewState.EMPTY;
    }
  }, [refusal, currentData, items.length, pageItems.length, lockedCount]);

  const allowance = useMemo<BestSellersBrowseAllowanceDto | null>(
    () => currentData?.allowance ?? refusal?.body.allowance ?? data?.allowance ?? null,
    [currentData?.allowance, refusal?.body.allowance, data?.allowance],
  );

  /*
   * Products per billing period, never "list loads": the same list reopened
   * on the same day is not recounted, so the figure is what the seller has
   * left to LOOK AT. An unmetered seller (`limit` = -1: enforcement off, no
   * subscription, or a plan without the limit) gets the unlimited wording
   * rather than "-1 of -1".
   */
  const allowanceLabel = useMemo<string | null>(() => {
    if (!allowance) {
      return null;
    }
    if (allowance.limit === BILLING_UNLIMITED) {
      return t('bestSellers.allowanceUnlimited');
    }
    return t('bestSellers.allowance', {
      remaining: countFormat.format(Math.max(0, allowance.remaining)),
      limit: countFormat.format(allowance.limit),
    });
  }, [allowance, countFormat, t]);

  const ratingOptions = useMemo<SelectOption[]>(
    () =>
      BEST_SELLERS_RATING_OPTIONS.map((value) => ({
        value,
        label:
          value === ''
            ? t('bestSellers.filters.anyRating')
            : t('bestSellers.filters.ratingAtLeast', { value: ratingFormat.format(Number(value)) }),
      })),
    [ratingFormat, t],
  );

  /** "12 of 50 products on this page" — only while a filter is narrowing the page. */
  const filterResultLabel = useMemo<string | null>(
    () =>
      filters.isActive && pageItems.length > 0
        ? t('bestSellers.filters.resultCount', {
            shown: countFormat.format(filteredItems.length),
            total: countFormat.format(pageItems.length),
          })
        : null,
    [filters.isActive, pageItems.length, filteredItems.length, countFormat, t],
  );

  const handleMinRatingChange = useCallback(
    (value: string | number) => filters.setMinRating(String(value)),
    [filters],
  );
  const handleMinReviewsChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => filters.setMinReviews(event.target.value),
    [filters],
  );
  const handlePriceMinChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => filters.setPriceMin(event.target.value),
    [filters],
  );
  const handlePriceMaxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => filters.setPriceMax(event.target.value),
    [filters],
  );

  const listTypeOptions = useMemo<TabNavItem[]>(
    () => BEST_SELLERS_LIST_TYPE_ORDER.map((value) => ({ id: value, label: t(`bestSellers.listTypes.${value}`) })),
    [t],
  );

  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);

  /*
   * The tree is a real tree (department → any depth), built from the cached
   * per-node answers — see `flattenCategoryTree`. The root row is added here
   * because it is not an Amazon node, only the "all categories" reset.
   */
  const isListLoading = viewState === BestSellersViewState.LOADING;
  const categoryTreeRows = useMemo<BestSellersCategoryTreeRow[]>(() => {
    const query = categorySearch.trim().toLowerCase();
    const nodeRows = flattenCategoryTree({
      bucket: categoryTree.bucket,
      category,
      isExpanded: categoryTree.isExpanded,
      query,
    });
    const root: BestSellersCategoryTreeRow = {
      key: 'root',
      path: BEST_SELLERS_ROOT_CATEGORY,
      name: t('bestSellers.allCategories'),
      depth: 0,
      isActive: category === BEST_SELLERS_ROOT_CATEGORY,
      isActiveBranch: false,
      hasChildren: false,
      isExpanded: false,
      isLoading: false,
    };
    return [
      root,
      ...nodeRows.map((row) => ({
        key: row.path,
        path: row.path,
        name: row.name,
        depth: row.depth,
        isActive: row.isActive,
        isActiveBranch: row.isActiveBranch,
        hasChildren: row.hasChildren,
        isExpanded: row.isExpanded,
        // The opened category learns its children from its own list answer.
        isLoading:
          categoryTree.isBranchLoading(row.path) ||
          (isListLoading && row.isActive && categoryTree.bucket.nodes[row.path]?.children === undefined),
      })),
    ];
  }, [categoryTree, categorySearch, category, isListLoading, t]);

  /*
   * The Amazon-rendered breadcrumb marks the currently browsed node with
   * `isSelected` — the truest source for its display name, ahead of anything
   * this page infers on its own. `data` (not just `currentData`) so the mobile
   * trigger keeps its label while a new page is loading.
   */
  const activeCategoryEntry = useMemo(
    () => (currentData?.list?.categories ?? data?.list?.categories)?.find((entry) => entry.isSelected) ?? null,
    [currentData?.list?.categories, data?.list?.categories],
  );
  const activeCategoryLabel =
    category === BEST_SELLERS_ROOT_CATEGORY ? t('bestSellers.allCategories') : (activeCategoryEntry?.name ?? category);

  const handleListTypeChange = useCallback(
    (value: string) => {
      if (BEST_SELLERS_LIST_TYPE_ORDER.includes(value as BestSellersListType)) {
        setListType(value as BestSellersListType);
      }
    },
    [setListType],
  );

  const handleCategorySelect = useCallback(
    (path: string) => {
      setCategory(path);
      setIsCategoryDrawerOpen(false);
    },
    [setCategory],
  );

  /*
   * The chevron never opens a list. A branch nobody has expanded yet asks the
   * API for its tree alone (`/best-sellers/categories?category=`), which shows
   * no product and so takes nothing from the allowance; the seller walks down
   * to the branch they want and only the label they finally press loads
   * products. The answer is cached for everyone for a week, and it also warms
   * that branch's list, so opening it afterwards is instant.
   */
  const handleToggleCategoryExpand = useCallback(
    (path: string) => {
      categoryTree.expandBranch(path);
    },
    [categoryTree],
  );

  const handleCategorySearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setCategorySearch(event.target.value);
  }, []);

  const handleOpenCategoryDrawer = useCallback(() => setIsCategoryDrawerOpen(true), []);
  const handleCloseCategoryDrawer = useCallback(() => setIsCategoryDrawerOpen(false), []);

  const handleBackToAllCategories = useCallback(() => {
    setCategory(BEST_SELLERS_ROOT_CATEGORY);
  }, [setCategory]);

  const handleToggleSelectAllOnPage = useCallback(
    (checked: boolean) => {
      if (checked) {
        selection.selectMany(pageAsins);
      } else {
        selection.deselectMany(pageAsins);
      }
    },
    [selection, pageAsins],
  );

  // The table hands back whatever rows it holds; a locked placeholder can
  // never be in the selection, whatever the caller's checkbox state says.
  const handleSelectionChange = useCallback(
    (selected: BestSellersItemView[]) => {
      selection.setPageSelection(
        pageAsins,
        selected.filter(isUnlocked).map((row) => row.asin),
      );
    },
    [selection, pageAsins],
  );

  const handleListSelected = useCallback(() => {
    if (selection.count === 0) {
      return;
    }
    localeNavigate(buildAddListingsPath([...selection.selectedAsins]));
  }, [selection.count, selection.selectedAsins, localeNavigate]);

  const handleUpgrade = useCallback(() => {
    localeNavigate(BILLING_PATH);
  }, [localeNavigate]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const totalCount = currentData?.list?.pagination.totalCount ?? 0;
  const pagination = useMemo<BestSellersPagination | undefined>(
    () =>
      totalCount > 0
        ? {
            count: Math.min(totalCount, BEST_SELLERS_PAGE_SIZE * BEST_SELLERS_MAX_PAGE),
            page,
            rowsPerPage: BEST_SELLERS_PAGE_SIZE,
            onPageChange: setPage,
            // Amazon renders exactly 50 per page; there is no other size to offer.
            onRowsPerPageChange: () => undefined,
            labelRowsPerPage: t('translation:common.rowsPerPage'),
            labelInfo: t('translation:common.showing_info'),
          }
        : undefined,
    [totalCount, page, setPage, t],
  );

  return (
    <EbayAccountGuard>
      <BestSellersPageComponent
        viewState={viewState}
        items={rows}
        selectedRows={selectedRows}
        onSelectionChange={handleSelectionChange}
        isRowSelectable={isUnlocked}
        hasSelectableItems={items.length > 0}
        lockedCount={lockedCount}
        onUpgrade={handleUpgrade}
        listTypeOptions={listTypeOptions}
        listType={listType}
        onListTypeChange={handleListTypeChange}
        categoryTreeRows={categoryTreeRows}
        categorySearchValue={categorySearch}
        onCategorySearchChange={handleCategorySearchChange}
        onCategorySelect={handleCategorySelect}
        onToggleCategoryExpand={handleToggleCategoryExpand}
        hasDepartments={(categoryTree.bucket.rootChildren?.length ?? 0) > 0}
        activeCategoryLabel={activeCategoryLabel}
        isCategoryDrawerOpen={isCategoryDrawerOpen}
        onOpenCategoryDrawer={handleOpenCategoryDrawer}
        onCloseCategoryDrawer={handleCloseCategoryDrawer}
        isSubCategory={category !== BEST_SELLERS_ROOT_CATEGORY}
        ratingOptions={ratingOptions}
        filterValues={filters.values}
        onMinRatingChange={handleMinRatingChange}
        onMinReviewsChange={handleMinReviewsChange}
        onPriceMinChange={handlePriceMinChange}
        onPriceMaxChange={handlePriceMaxChange}
        hasActiveFilters={filters.isActive}
        onClearFilters={filters.clear}
        filterResultLabel={filterResultLabel}
        onBackToAllCategories={handleBackToAllCategories}
        selectedCount={selection.count}
        isAllOnPageSelected={isAllOnPageSelected}
        onToggleSelectAllOnPage={handleToggleSelectAllOnPage}
        onToggleItem={selection.toggle}
        onListSelected={handleListSelected}
        onClearSelection={selection.clear}
        onRetry={handleRetry}
        allowanceLabel={allowanceLabel}
        pagination={pagination}
      />
    </EbayAccountGuard>
  );
};

BestSellersPageContainer.displayName = 'BestSellersPageContainer';
