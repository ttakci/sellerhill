import { ORDER_STAGE_TABS, OrderShipByState, OrderStage, OrderStageTab, type OrderFiltersDto } from '@repo/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { SELLER_VISIBLE_ORDER_STAGES } from '../../shared/order-stage';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';

const isTab = (value: string): value is OrderStageTab => (Object.values(OrderStageTab) as string[]).includes(value);

const isStage = (value: string): value is OrderStage => (Object.values(OrderStage) as string[]).includes(value);

/**
 * The flag filter (`?flag=`): conditions that sit BESIDE the stage — eBay's
 * ship-by deadline and a refund — so an order can be "purchased" and "late"
 * at once. One select, because a seller looks for one of them at a time.
 */
const FLAG_REFUNDED = 'refunded';

const isShipByState = (value: string): value is OrderShipByState =>
  (Object.values(OrderShipByState) as string[]).includes(value);

const readFlag = (value: string | null): string =>
  value && (isShipByState(value) || value === FLAG_REFUNDED) ? value : '';

/**
 * The listing-link filter (`?tracking=`). The list opens on TRACKED orders —
 * the sales of listings SellerHill manages (operator decision, 2026-10-01): a
 * store connected with years of history shows hundreds of sales the platform
 * can neither cost nor fulfil, and they buried the handful it is working on.
 * "All" and "Not tracked" are one select away, and the default is the only
 * value left out of the URL — so a link that must show everything says so
 * with `tracking=all`.
 */
const TRACKING = { ALL: 'all', TRACKED: 'tracked', UNTRACKED: 'untracked' } as const;
const DEFAULT_TRACKING: string = TRACKING.TRACKED;

const readTracking = (value: string | null): string =>
  value === TRACKING.ALL || value === TRACKING.UNTRACKED || value === TRACKING.TRACKED ? value : DEFAULT_TRACKING;

/**
 * Orders list UI filters + server query DTO (search debounce, stage tab +
 * stage select, store, listing-link, page, date range).
 *
 * The eBay status and the Amazon-fulfillment selects are gone: both were
 * folded into ONE seller-facing stage (`OrderStage`), which the counted tabs
 * group and the Status select narrows. Tabs and select both write `?stage=` /
 * `?tab=` so a link from the Action Center (`/orders?stage=purchase_blocked`)
 * lands filtered instead of on all 400 orders.
 */
export function useOrdersFilters() {
  const { t } = useTranslation(['orders', 'translation']);
  const [searchParams, setSearchParams] = useSearchParams();

  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const fromDashboard = searchParams.get('from') === 'dashboard';
  const stageFromUrl = searchParams.get('stage') ?? '';
  const tabFromUrl = searchParams.get('tab') ?? '';
  const trackingFromUrl = readTracking(searchParams.get('tracking'));
  const flagFromUrl = readFlag(searchParams.get('flag'));
  /** True when the URL already expresses an intent — a tab, a stage, or any
   *  deep-link filter (the dashboard's "view all" carries dates + tracking).
   *  Only a bare `/orders` may be opened on "Needs action" by the container. */
  const hasUrlSelection = Boolean(
    stageFromUrl ||
      tabFromUrl ||
      flagFromUrl ||
      dateFrom ||
      dateTo ||
      fromDashboard ||
      searchParams.get('tracking')
  );

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState(isStage(stageFromUrl) ? stageFromUrl : '');
  const [tab, setTab] = useState<OrderStageTab>(isTab(tabFromUrl) ? tabFromUrl : OrderStageTab.ALL);
  const [trackingState, setTrackingState] = useState(trackingFromUrl);
  const [flag, setFlag] = useState(flagFromUrl);
  // `<column>:<asc|desc>`; empty = the API's own order (needs-action first, then newest).
  const [sort, setSort] = useState('');

  // The store is the top bar's active store. A switch starts the list over
  // (page 1) — adjusted during render, so no frame asks for page 4 of the new store.
  const { activeStoreId } = useActiveStore();
  const ebayAccountId = activeStoreId ?? '';
  const [pageStore, setPageStore] = useState(ebayAccountId);
  if (pageStore !== ebayAccountId) {
    setPageStore(ebayAccountId);
    setPage(1);
  }

  // Same for the stage, so navigating between two Action Center rows
  // re-filters instead of keeping the first one's selection.
  useEffect(() => {
    setStage(isStage(stageFromUrl) ? stageFromUrl : '');
    setPage(1);
  }, [stageFromUrl]);

  useEffect(() => {
    setTab(isTab(tabFromUrl) ? tabFromUrl : OrderStageTab.ALL);
    setPage(1);
  }, [tabFromUrl]);

  // …and for the listing-link filter: an Action Center row carries
  // `tracking=all`, the next plain visit to `/orders` is back on the default.
  useEffect(() => {
    setTrackingState(trackingFromUrl);
    setPage(1);
  }, [trackingFromUrl]);

  // …and for the flag, which the Action Center's "late to ship" row carries.
  useEffect(() => {
    setFlag(flagFromUrl);
    setPage(1);
  }, [flagFromUrl]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const stageOptions = useMemo(
    () => [
      { value: '', label: t('orders.filters.allStages') },
      ...SELLER_VISIBLE_ORDER_STAGES.map((s) => ({ value: s, label: t(`orders.stage.${s}.label`) })),
    ],
    [t]
  );

  /**
   * Whether the order matched a SellerHill listing at all — independent of
   * the stage. A matched order can still be "to purchase" (automation simply
   * off), so the stage alone cannot answer "is this even one of ours" for a
   * seller migrating in existing eBay sales.
   */
  const trackingOptions = useMemo(
    () => [
      { value: TRACKING.ALL, label: t('orders.filters.allTrackingStates') },
      { value: TRACKING.TRACKED, label: t('orders.tracking.tracked') },
      { value: TRACKING.UNTRACKED, label: t('orders.tracking.untracked') },
    ],
    [t]
  );

  const flagOptions = useMemo(
    () => [
      { value: '', label: t('orders.filters.allFlags') },
      { value: OrderShipByState.LATE, label: t('orders.flags.late') },
      { value: OrderShipByState.DUE_SOON, label: t('orders.flags.dueSoon') },
      { value: FLAG_REFUNDED, label: t('orders.flags.refunded') },
    ],
    [t]
  );

  const sortOptions = useMemo(
    () =>
      [
        { key: 'order_date', label: t('orders.table.date') },
        { key: 'sale_total', label: t('orders.table.salePrice') },
        { key: 'net_profit', label: t('orders.table.netProfit') },
      ].flatMap(({ key, label }) => [
        { value: `${key}:desc`, label: `${label} ↓` },
        { value: `${key}:asc`, label: `${label} ↑` },
      ]),
    [t]
  );

  const handleSortChange = useCallback((value: string | number) => {
    setSort(String(value));
    setPage(1);
  }, []);

  const hasActiveFilters = Boolean(
    search ||
      dateFrom ||
      dateTo ||
      stage ||
      flag ||
      tab !== OrderStageTab.ALL ||
      trackingState !== DEFAULT_TRACKING
  );

  const serverQuery: OrderFiltersDto = useMemo(
    () => ({
      page,
      limit: rowsPerPage,
      search: search || undefined,
      ebayAccountId: ebayAccountId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      // The select narrows to one stage; otherwise the tab's group applies.
      // "Needs action" is not a group of stages — a late order in any open
      // stage belongs to it — so it travels as its own flag.
      stages: stage
        ? [stage as OrderStage]
        : tab === OrderStageTab.ALL || tab === OrderStageTab.ACTION
          ? undefined
          : [...ORDER_STAGE_TABS[tab]],
      needsAction: !stage && tab === OrderStageTab.ACTION ? true : undefined,
      shipBy: isShipByState(flag) ? flag : undefined,
      hasRefund: flag === FLAG_REFUNDED ? true : undefined,
      isTracked:
        trackingState === TRACKING.TRACKED ? true : trackingState === TRACKING.UNTRACKED ? false : undefined,
      // Without a picked sort the API floats the stages that need the seller
      // to the top, then newest first.
      sortBy: sort ? sort.split(':')[0] : undefined,
      sortOrder: sort ? (sort.split(':')[1] === 'asc' ? ('asc' as const) : ('desc' as const)) : undefined,
    }),
    [page, rowsPerPage, search, ebayAccountId, dateFrom, dateTo, stage, tab, trackingState, flag, sort]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleStageChange = useCallback(
    (value: string | number) => {
      const v = String(value);
      setStage(isStage(v) ? v : '');
      // One stage replaces the tab's group, so the rail goes back to "All" —
      // otherwise "Done" would stay highlighted over a list of to-purchase rows.
      setTab(OrderStageTab.ALL);
      setPage(1);
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      if (isStage(v)) {
        next.set('stage', v);
      } else {
        next.delete('stage');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleTabChange = useCallback(
    (tabId: string) => {
      const nextTab = isTab(tabId) ? tabId : OrderStageTab.ALL;
      setTab(nextTab);
      setStage('');
      setPage(1);
      const next = new URLSearchParams(searchParams);
      next.delete('stage');
      if (nextTab === OrderStageTab.ALL) {
        next.delete('tab');
      } else {
        next.set('tab', nextTab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleTrackingStateChange = useCallback(
    (value: string | number) => {
      const v = readTracking(String(value));
      setTrackingState(v);
      setPage(1);
      const next = new URLSearchParams(searchParams);
      // The default stays out of the URL, like every other filter's default.
      if (v === DEFAULT_TRACKING) {
        next.delete('tracking');
      } else {
        next.set('tracking', v);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleFlagChange = useCallback(
    (value: string | number) => {
      const v = readFlag(String(value));
      setFlag(v);
      setPage(1);
      const next = new URLSearchParams(searchParams);
      if (v) {
        next.set('flag', v);
      } else {
        next.delete('flag');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // No date-range setters here on purpose: `dateFrom`/`dateTo` are read-only
  // inbound state, arriving from the dashboard's "view all" deep link. The list
  // has no date inputs of its own, and `handleClearFilters` already drops them.

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setStage('');
    setTab(OrderStageTab.ALL);
    setTrackingState(DEFAULT_TRACKING);
    setFlag('');
    setSort('');
    setPage(1);
    // Clearing filters never clears the store: it is the top bar's choice.
    const next = new URLSearchParams();
    if (ebayAccountId) {
      next.set('store', ebayAccountId);
    }
    if (fromDashboard) {
      next.set('from', 'dashboard');
    }
    setSearchParams(next, { replace: true });
  }, [ebayAccountId, fromDashboard, setSearchParams]);

  const handleRowsPerPageChange = useCallback((rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  }, []);

  return {
    page,
    setPage,
    rowsPerPage,
    handleRowsPerPageChange,
    searchInput,
    handleSearchChange,
    ebayAccountId,
    tab,
    handleTabChange,
    hasUrlSelection,
    stage,
    stageOptions,
    handleStageChange,
    trackingState,
    trackingOptions,
    handleTrackingStateChange,
    flag,
    flagOptions,
    handleFlagChange,
    handleClearFilters,
    hasActiveFilters,
    sortOptions,
    sort,
    handleSortChange,
    serverQuery,
    fromDashboard,
    dateFrom,
    dateTo,
  };
}
