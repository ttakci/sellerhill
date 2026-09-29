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
  BestSellersListType,
  SourceFetchOutcome, type BestSellersBrowseAllowanceDto, type BestSellersQueryDto,
} from '@repo/shared';
import { formatCurrency, getLocaleConfig, type SelectOption, type TabNavItem } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetBestSellersQuery } from '../api/bestSellersApi';
import { BestSellersViewState, type BestSellersKnownCategories, type BestSellersRefusalBody } from '../bestSellers.types';
import { useBestSellersSelection } from '../hooks/useBestSellersSelection';
import { useBestSellersUrlState } from '../hooks/useBestSellersUrlState';

import { BestSellersPage as BestSellersPageComponent } from './BestSellersPage.component';
import type { BestSellersItemView, BestSellersPagination } from './BestSellersPage.types';

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

export const BestSellersPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['bestSellers', 'translation']);
  const { localeNavigate } = useLocale();
  const { listType, category, page, setListType, setCategory, setPage } = useBestSellersUrlState();
  const selection = useBestSellersSelection();

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
   * category tree at all. Remembering the last tree we saw for this list keeps
   * the picker usable on that screen, so the seller can pick another category
   * rather than being stranded on "Back to all categories" alone. Adjusted
   * during render (the same pattern `AddListingsDrawer` uses for its open
   * transition) rather than in an effect, so there is no extra render pass.
   */
  const [known, setKnown] = useState<BestSellersKnownCategories>({ listType, categories: [] });
  const freshCategories = currentData?.list?.categories;
  if (known.listType !== listType) {
    setKnown({ listType, categories: freshCategories && freshCategories.length > 0 ? freshCategories : [] });
  } else if (freshCategories && freshCategories.length > 0 && freshCategories !== known.categories) {
    setKnown({ listType, categories: freshCategories });
  }
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

  const items = useMemo<BestSellersItemView[]>(
    () =>
      (currentData?.list?.items ?? []).map((item) => {
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
          reviewsLabel,
          isSelected: selection.isSelected(item.asin),
        };
      }),
    [currentData?.list?.items, countFormat, ratingFormat, localeCfg, selection, t],
  );

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
        return items.length > 0 ? BestSellersViewState.READY : BestSellersViewState.EMPTY;
    }
  }, [refusal, currentData, items.length]);

  const allowance = useMemo<BestSellersBrowseAllowanceDto | null>(
    () => currentData?.allowance ?? refusal?.body.allowance ?? data?.allowance ?? null,
    [currentData?.allowance, refusal?.body.allowance, data?.allowance],
  );

  const listTypeOptions = useMemo<TabNavItem[]>(
    () => BEST_SELLERS_LIST_TYPE_ORDER.map((value) => ({ id: value, label: t(`bestSellers.listTypes.${value}`) })),
    [t],
  );

  const categoryOptions = useMemo<SelectOption[]>(() => {
    const knownCategories = known.listType === listType ? known.categories : [];
    const options: SelectOption[] = [
      { label: t('bestSellers.allCategories'), value: BEST_SELLERS_ROOT_CATEGORY },
    ];
    knownCategories.forEach((entry) => {
      if (!entry.isRoot && entry.path) {
        options.push({ label: entry.name, value: entry.path });
      }
    });
    // The open sub-category may not be in the tree Amazon rendered (deep
    // paths); keep it selectable so the picker never shows a blank value.
    if (category !== BEST_SELLERS_ROOT_CATEGORY && !options.some((option) => option.value === category)) {
      const selected = knownCategories.find((entry) => entry.isSelected);
      options.push({ label: selected?.name ?? category, value: category });
    }
    return options;
  }, [known, listType, category, t]);

  const handleListTypeChange = useCallback(
    (value: string) => {
      if (BEST_SELLERS_LIST_TYPE_ORDER.includes(value as BestSellersListType)) {
        setListType(value as BestSellersListType);
      }
    },
    [setListType],
  );

  const handleCategoryChange = useCallback(
    (value: string | number) => {
      setCategory(String(value));
    },
    [setCategory],
  );

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

  const handleSelectionChange = useCallback(
    (rows: BestSellersItemView[]) => {
      selection.setPageSelection(
        pageAsins,
        rows.map((row) => row.asin),
      );
    },
    [selection, pageAsins],
  );

  const handleControlClick = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  const handleListSelected = useCallback(() => {
    if (selection.count === 0) {
      return;
    }
    localeNavigate(buildAddListingsPath([...selection.selectedAsins]));
  }, [selection.count, selection.selectedAsins, localeNavigate]);

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
        items={items}
        selectedRows={selectedRows}
        onSelectionChange={handleSelectionChange}
        listTypeOptions={listTypeOptions}
        listType={listType}
        onListTypeChange={handleListTypeChange}
        categoryOptions={categoryOptions}
        category={category}
        onCategoryChange={handleCategoryChange}
        isSubCategory={category !== BEST_SELLERS_ROOT_CATEGORY}
        onBackToAllCategories={handleBackToAllCategories}
        selectedCount={selection.count}
        isAllOnPageSelected={isAllOnPageSelected}
        onToggleSelectAllOnPage={handleToggleSelectAllOnPage}
        onToggleItem={selection.toggle}
        onControlClick={handleControlClick}
        onListSelected={handleListSelected}
        onClearSelection={selection.clear}
        onRetry={handleRetry}
        allowance={allowance}
        pagination={pagination}
      />
    </EbayAccountGuard>
  );
};

BestSellersPageContainer.displayName = 'BestSellersPageContainer';
