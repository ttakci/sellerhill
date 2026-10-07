import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import {
  ActionCenterItemKey,
  ActionCenterSeverity,
  BEST_SELLERS_LIST_TYPE_ORDER,
  BestSellersListType,
  DashboardRangePreset,
  DEFAULT_DASHBOARD_RANGE_PRESET,
  EbayConversationDto,
  EbayConversationStatus,
  ListingStatus,
  OrderCostCaptureStatus,
  orderNeedsAction,
  OrderFulfillmentState,
  OrderStage,
  RETURN_TABS,
  CANCELLATION_TABS,
  CancellationBucket,
  CancellationTab,
  ReturnBucket,
  ReturnTab,
  type ActionCenterSummaryDto,
  type ListingDto,
  type EbayCancellationDto,
  type EbayReturnDto,
  type OrderDto,
  type OrderStageCountsDto,
  type DashboardRangeInput,
} from '@repo/shared';

import {
  buildDemoActionCenter,
  buildDemoBestSellers,
  buildDemoBillingDetails,
  buildDemoBillingInvoices,
  buildDemoBillingSummary,
  buildDemoDashboard,
  buildDemoOrderStats,
  buildDemoUnread,
  buildDemoUnreadBreakdown,
  demoAllListingRevisions,
  demoJobItems,
  demoListingRevisions,
  demoStoreSettingsFor,
  demoThread,
  DEMO_AMAZON_ACCOUNTS,
  DEMO_CAMPAIGNS,
  demoCampaignCandidates,
  demoCampaignDetail,
  demoListingCampaign,
  DEMO_BILLING_CATALOG,
  DEMO_BUSINESS_POLICIES,
  DEMO_BUYER_MESSAGE_TEMPLATES,
  DEMO_CONVERSATIONS,
  DEMO_EBAY_ACCOUNT_ID,
  DEMO_EBAY_ACCOUNTS,
  DEMO_LISTING_CATEGORIES,
  DEMO_LISTING_GROUPS,
  DEMO_LISTING_JOBS,
  DEMO_LISTINGS,
  DEMO_ORDERS,
  demoOrderTimeline,
  demoCancellationDetail,
  demoReturnDetail,
  DEMO_PREDEFINED_TEMPLATES,
  DEMO_PROFILE,
  DEMO_CANCELLATIONS,
  DEMO_RETURNS,
  DEMO_STORE_SETTINGS_ALL,
  DEMO_USER,
} from './demoData';

/* =========================================================================
 * Request router for demo mode.
 *
 * Stands in for `fetchBaseQuery` and answers from fixtures. Two rules keep it
 * honest:
 *
 *  1. Nothing leaves the browser. A visitor exploring the demo must not spend
 *     eBay call budget, Keepa tokens or provider quota — those are metered per
 *     application and shared by every real seller.
 *  2. Writes are refused rather than faked. A mutation that appears to succeed
 *     but vanishes on reload is a worse demo than one that says plainly that
 *     this is a read-only tour.
 * ========================================================================= */

/**
 * Broadcast when a write is refused. `DemoBanner` listens for it and explains
 * the refusal once, centrally — the alternative was teaching every mutation
 * site in the app about demo mode, which would leave the explanation missing
 * wherever someone forgot.
 */
export const DEMO_READONLY_EVENT = 'sellerhill:demo-readonly';

interface ParsedRequest {
  path: string;
  method: string;
  params: Record<string, string>;
  body: unknown;
}

function parseRequest(args: string | FetchArgs): ParsedRequest {
  const raw: FetchArgs = typeof args === 'string' ? { url: args } : args;
  const [rawPath, inlineQuery] = raw.url.split('?');

  // Query values arrive two ways — inline on the url, or as a `params` object.
  // Both are normalised to strings here so every handler reads one shape.
  const params: Record<string, string> = {};
  new URLSearchParams(inlineQuery ?? '').forEach((v, k) => {
    params[k] = v;
  });
  const declared = raw.params as Record<string, unknown> | undefined;
  if (declared) {
    Object.entries(declared).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params[k] = String(v);
      }
    });
  }

  return {
    path: `/${rawPath.replace(/^\/+|\/+$/g, '')}`,
    method: (raw.method ?? 'GET').toUpperCase(),
    params,
    body: raw.body,
  };
}

/**
 * Every answer goes through a JSON round-trip, exactly what the real network
 * does to a response. Some fixtures are typed against shared DTOs that declare
 * `Date` fields (store settings, listing groups, templates); handed over as-is,
 * those `Date` objects reached the Redux store and RTK's serializability check
 * logged an error on every render. The round-trip turns them into the ISO
 * strings the real API sends, and gives each query a fresh copy so a cached
 * fixture is never frozen or shared between two cache entries.
 */
/** Pages that read `?store=` — the API's `STORE_FILTERABLE_PATHS`. */
const DEMO_STORE_FILTERABLE_PATHS = ['/orders', '/listings', '/listings/all', '/listings/jobs', '/returns', '/cancellations'];

/**
 * The demo Action Center narrowed to one store, as `?ebayAccountId=` does on
 * the API: each item is recounted over that store's own fixture rows (an item
 * the fixtures cannot split, such as the job failures, belongs to the first
 * store), and its link carries `store=`. A breakdown survives only when the
 * count did not change, so the chips never add up to more than the item.
 */
function scopeDemoActionCenter(summary: ActionCenterSummaryDto, storeId: string): ActionCenterSummaryDto {
  const orders = DEMO_ORDERS.filter((o) => o.ebayAccountId === storeId);
  const listings = DEMO_LISTINGS.filter((l) => l.ebayAccountId === storeId);
  const byStage = (stage: OrderStage) => orders.filter((o) => o.stage === stage).length;
  const counters: Partial<Record<ActionCenterItemKey, () => number>> = {
    [ActionCenterItemKey.ORDER_AMAZON_CANCELLED]: () => byStage(OrderStage.AMAZON_CANCELLED),
    [ActionCenterItemKey.ORDER_FULFILLMENT_BLOCKED]: () => byStage(OrderStage.PURCHASE_BLOCKED),
    [ActionCenterItemKey.ORDER_TRACKING_CONVERSION_HELD]: () => byStage(OrderStage.TRACKING_HELD),
    [ActionCenterItemKey.ORDER_UNTRACKED]: () =>
      orders.filter((o) => o.costCaptureStatus === OrderCostCaptureStatus.UNTRACKED).length,
    [ActionCenterItemKey.LISTING_OUT_OF_STOCK]: () =>
      listings.filter((l) => l.status === ListingStatus.ACTIVE && l.quantity === 0).length,
    [ActionCenterItemKey.LISTING_DRAFTS_PENDING]: () => listings.filter((l) => l.status === ListingStatus.DRAFT).length,
  };
  const withStore = (path: string | null) =>
    path && DEMO_STORE_FILTERABLE_PATHS.includes(path.split('?')[0])
      ? `${path}${path.includes('?') ? '&' : '?'}store=${encodeURIComponent(storeId)}`
      : path;

  const groups = summary.groups
    .map((group) => {
      const items = group.items
        .map((item) => {
          const counter = counters[item.key];
          const count = counter ? counter() : storeId === DEMO_EBAY_ACCOUNT_ID ? item.count : 0;
          return {
            ...item,
            count,
            breakdown: count === item.count ? item.breakdown : undefined,
            actionPath: withStore(item.actionPath),
          };
        })
        .filter((item) => item.count > 0);
      return { ...group, items, itemCount: items.length };
    })
    .filter((group) => group.itemCount > 0);

  const all = groups.flatMap((group) => group.items);
  const countBy = (severity: ActionCenterSeverity) => all.filter((item) => item.severity === severity).length;
  return {
    ...summary,
    totalCount: all.length,
    criticalCount: countBy(ActionCenterSeverity.CRITICAL),
    warningCount: countBy(ActionCenterSeverity.WARNING),
    infoCount: countBy(ActionCenterSeverity.INFO),
    groups,
  };
}

function ok<T>(data: T): { data: T } {
  return { data: data === undefined ? data : (JSON.parse(JSON.stringify(data)) as T) };
}

/**
 * A write in demo mode resolves as a benign success, never as an error.
 *
 * Returning a rejection was the obvious first design and it was wrong: feature
 * containers `.catch()` their mutations and raise their own generic red "an
 * error occurred" modal, which is exactly the alarming outcome a demo must not
 * produce when someone clicks Upgrade. Succeeding with a payload that carries
 * no side effect means the container's success path runs and simply does
 * nothing — the tag invalidation refetches the same fixtures, so the screen
 * stays put.
 *
 * Nothing is persisted either way; the one notice below is what tells the
 * visitor why their change did not stick.
 */
function demoWrite(path: string, body: unknown): { data: unknown } {
  window.dispatchEvent(new CustomEvent(DEMO_READONLY_EVENT));

  // Checkout is the dangerous one: a URL here would send the visitor to a real
  // payment page. A null URL makes `if (result.checkoutUrl)` a no-op.
  if (path === '/billing/checkout') {
    return ok({ checkoutUrl: null, provider: 'local' });
  }
  if (path === '/listings/export') {
    return ok('sku,title,price,quantity\n');
  }

  // The bulk-status caller reads `failed.length` off every chunk's result —
  // the generic echo below has no such field, so this one write is mapped
  // explicitly rather than letting a demo click throw.
  if (path === '/ebay/messages/conversations/bulk-status') {
    const conversationIds = (body as { conversationIds?: string[] } | null)?.conversationIds ?? [];
    return ok({ succeeded: conversationIds, failed: [] });
  }

  // Campaign member writes report per-listing outcomes; echo every id as
  // confirmed so the drawer's success path runs (the refetch restores fixtures).
  if (/^\/campaigns\/\d+\/(listings\/(add|remove)|rate)$/.test(path)) {
    const listingIds = (body as { listingIds?: string[] } | null)?.listingIds ?? [];
    return ok({
      campaignId: path.split('/')[2],
      results: listingIds.map((listingId) => ({ listingId, outcome: 'added' })),
    });
  }
  if (path === '/campaigns' || /^\/campaigns\/\d+\/actions\//.test(path)) {
    return ok(DEMO_CAMPAIGNS[0]);
  }

  // Echo the request body so a container reading the "updated entity" back
  // still has the shape it expects; the refetch that follows restores the
  // fixture values.
  const echoed = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  return ok({ id: 'demo-generated', messageId: 'demo-generated', success: true, count: 0, ...echoed });
}

function paginate<T>(rows: T[], params: Record<string, string>) {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.max(1, Number(params.limit) || 20);
  const start = (page - 1) * limit;
  return { items: rows.slice(start, start + limit), total: rows.length, page, limit };
}

/* ── Listings ─────────────────────────────────────────────────────────── */

function filterListings(params: Record<string, string>): ListingDto[] {
  let rows = [...DEMO_LISTINGS];

  // Query values are untyped wire input, so enum-valued filters compare as
  // strings rather than pretending the param is already the enum.
  const status = params.status;
  if (status && status !== 'all') {
    rows = rows.filter((l) => String(l.status) === status);
  } else {
    // Matches the API: drafts are a dedicated view, never mixed into "all".
    rows = rows.filter((l) => l.status !== ListingStatus.DRAFT);
  }

  const search = params.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (l) =>
        l.title.toLowerCase().includes(search) ||
        l.asin.toLowerCase().includes(search) ||
        (l.brand ?? '').toLowerCase().includes(search)
    );
  }
  if (params.category) {
    rows = rows.filter((l) => l.category === params.category);
  }
  if (params.ebayAccountId) {
    rows = rows.filter((l) => l.ebayAccountId === params.ebayAccountId);
  }
  if (params.quantityMax !== undefined) {
    rows = rows.filter((l) => l.quantity <= Number(params.quantityMax));
  }
  if (params.quantityMin !== undefined) {
    rows = rows.filter((l) => l.quantity >= Number(params.quantityMin));
  }

  const dir = params.sortOrder === 'asc' ? 1 : -1;
  const key = params.sortBy;
  if (key) {
    rows.sort((a, b) => {
      const pick = (l: ListingDto): number | string => {
        switch (key) {
          case 'price':
            return l.price;
          case 'quantity':
            return l.quantity;
          case 'sold':
          case 'soldCount':
            return l.soldCount ?? 0;
          case 'profit':
          case 'estimatedProfit':
            return l.estimatedProfit ?? 0;
          case 'lastSale':
          case 'lastSaleAt':
            return l.lastSaleAt ?? '';
          case 'title':
            return l.title;
          default:
            return l.createdAt;
        }
      };
      const av = pick(a);
      const bv = pick(b);
      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  return rows;
}

/* ── Orders ───────────────────────────────────────────────────────────── */

function filterOrders(params: Record<string, string>): OrderDto[] {
  let rows = [...DEMO_ORDERS];

  const search = params.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (o) =>
        (o.product?.title ?? '').toLowerCase().includes(search) ||
        o.ebayOrderId.toLowerCase().includes(search) ||
        (o.buyerName ?? '').toLowerCase().includes(search) ||
        (o.sellerNote ?? '').toLowerCase().includes(search)
    );
  }
  if (params.status && params.status !== 'all') {
    rows = rows.filter((o) => String(o.status) === params.status);
  }
  if (params.fulfillmentState && params.fulfillmentState !== 'all') {
    rows = rows.filter((o) => String(o.fulfillmentState) === params.fulfillmentState);
  }
  // `?stage=a,b` — a tab group, or the one stage the Status select chose.
  if (params.stage) {
    const wanted = new Set(params.stage.split(',').filter(Boolean));
    rows = rows.filter((o) => wanted.has(o.stage));
  }
  // The flags beside the stage, and the Needs-action tab that reads both.
  if (params.needsAction === 'true') {
    rows = rows.filter((o) => orderNeedsAction(o.stage, o.shipByState));
  }
  if (params.shipBy) {
    rows = rows.filter((o) => String(o.shipByState ?? '') === params.shipBy);
  }
  if (params.refunded === 'true') {
    rows = rows.filter((o) => (o.ebayRefundedAmount ?? 0) > 0);
  }
  if (params.autoFulfillNeedsAttention === 'true') {
    rows = rows.filter((o) => o.fulfillmentState === OrderFulfillmentState.ACTION_REQUIRED || o.amazonCancelledAt);
  }
  if (params.tracked === 'true' || params.tracked === 'false') {
    rows = rows.filter((o) => o.isTracked === (params.tracked === 'true'));
  }
  if (params.ebayAccountId) {
    // Sample orders are spread across both demo stores by listing index.
    rows = rows.filter((o) => {
      // Keyed on the fixture index, not the position in the filtered list, so a
      // store's orders are the same rows whatever other filters ran first.
      const i = DEMO_ORDERS.indexOf(o);
      return params.ebayAccountId === DEMO_EBAY_ACCOUNTS.items[1].id ? i % 4 === 0 : i % 4 !== 0;
    });
  }
  if (params.dateFrom) {
    rows = rows.filter((o) => o.createdAt >= params.dateFrom);
  }
  if (params.dateTo) {
    rows = rows.filter((o) => o.createdAt <= `${params.dateTo}T23:59:59.999Z`);
  }

  // Same default order as the API: what needs the seller first, then newest.
  if (!params.sortBy) {
    const rank = (o: OrderDto) => (orderNeedsAction(o.stage, o.shipByState) ? 0 : 1);
    rows.sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  }

  return rows;
}

/** Whole-store stage counts for the list page tabs (store / link filters only). */
function countOrderStages(params: Record<string, string>): OrderStageCountsDto {
  const scoped = filterOrders({ ebayAccountId: params.ebayAccountId ?? '', tracked: params.tracked ?? '' });
  const counts = Object.fromEntries(Object.values(OrderStage).map((s) => [s, 0])) as OrderStageCountsDto;
  for (const order of scoped) {
    counts[order.stage] += 1;
  }
  counts.needsAction = scoped.filter((o) => orderNeedsAction(o.stage, o.shipByState)).length;
  return counts;
}

/* ── eBay Messages ────────────────────────────────────────────────────── */

/**
 * Mirrors the real endpoint's own contract: `type` narrows to one type (omitted in Archive / Deleted), and `status`
 * carries the folder rail's meaning — `UNREAD` filters by unread count rather
 * than eBay's own `UNREAD` status, `ARCHIVE` matches the archived status, and
 * no `status` at all (the "All" folder) means the live `ACTIVE` set.
 */
function filterConversations(params: Record<string, string>): EbayConversationDto[] {
  // No `type` = both types (the Archive / Deleted folders).
  let rows = DEMO_CONVERSATIONS.filter((conversation) => !params.type || String(conversation.type) === params.type);

  if (params.status === String(EbayConversationStatus.UNREAD)) {
    rows = rows.filter((conversation) => conversation.unreadCount > 0);
  } else if (params.status === String(EbayConversationStatus.ARCHIVE)) {
    rows = rows.filter((conversation) => conversation.status === EbayConversationStatus.ARCHIVE);
  } else if (params.status === String(EbayConversationStatus.DELETE)) {
    rows = rows.filter((conversation) => conversation.status === EbayConversationStatus.DELETE);
  } else {
    rows = rows.filter((conversation) => conversation.status === EbayConversationStatus.ACTIVE);
  }

  return rows.sort((a, b) =>
    (b.latestMessage?.createdAt ?? b.createdAt).localeCompare(a.latestMessage?.createdAt ?? a.createdAt)
  );
}

/* ── eBay cancellation requests ───────────────────────────────────────── */

/** `GET /cancellations` — tab (a bucket group), store and search, like the real endpoint. */
function filterCancellations(params: Record<string, string>): EbayCancellationDto[] {
  let rows = [...DEMO_CANCELLATIONS];

  const tab = Object.values(CancellationTab).find((value) => String(value) === params.tab);
  if (tab && tab !== CancellationTab.ALL) {
    const wanted = CANCELLATION_TABS[tab];
    rows = rows.filter((c) => wanted.includes(c.bucket));
  }
  if (params.ebayAccountId) {
    rows = rows.filter((c) => c.ebayAccountId === params.ebayAccountId);
  }
  // Matches the cancel id, the eBay order id or the product title.
  const search = params.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (c) =>
        c.cancelId.toLowerCase().includes(search) ||
        (c.legacyOrderId ?? '').toLowerCase().includes(search) ||
        (c.product?.title ?? '').toLowerCase().includes(search)
    );
  }

  // What needs the seller first, a closed request last; newest first inside a bucket.
  const BUCKET_ORDER = Object.values(CancellationBucket);
  return rows.sort(
    (a, b) =>
      BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) ||
      (b.requestedAt ?? '').localeCompare(a.requestedAt ?? '')
  );
}

/** Whole-store bucket counts for the tab rail (store filter only — never tab or search). */
function countCancellationBuckets(params: Record<string, string>): Record<CancellationBucket, number> {
  const counts = Object.fromEntries(Object.values(CancellationBucket).map((b) => [b, 0])) as Record<
    CancellationBucket,
    number
  >;
  for (const row of filterCancellations({ ebayAccountId: params.ebayAccountId ?? '' })) {
    counts[row.bucket] += 1;
  }
  return counts;
}

/* ── eBay returns ─────────────────────────────────────────────────────── */

/** `GET /returns` — tab (a bucket group), store and search, like the real endpoint. */
function filterReturns(params: Record<string, string>): EbayReturnDto[] {
  let rows = [...DEMO_RETURNS];

  const tab = Object.values(ReturnTab).find((value) => String(value) === params.tab);
  if (tab && tab !== ReturnTab.ALL) {
    const wanted = RETURN_TABS[tab];
    rows = rows.filter((r) => wanted.includes(r.bucket));
  }
  if (params.ebayAccountId) {
    rows = rows.filter((r) => r.ebayAccountId === params.ebayAccountId);
  }
  // Matches the eBay return id, the eBay order id or the product title.
  const search = params.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (r) =>
        r.returnId.toLowerCase().includes(search) ||
        (r.ebayOrderId ?? '').toLowerCase().includes(search) ||
        (r.product?.title ?? '').toLowerCase().includes(search)
    );
  }

  // What needs the seller first, a closed return last; newest first inside a bucket.
  const BUCKET_ORDER = Object.values(ReturnBucket);
  return rows.sort(
    (a, b) =>
      BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket) ||
      (b.createdOnEbayAt ?? '').localeCompare(a.createdOnEbayAt ?? '')
  );
}

/** Whole-store bucket counts for the tab rail (store filter only — never tab or search). */
function countReturnBuckets(params: Record<string, string>): Record<ReturnBucket, number> {
  const counts = Object.fromEntries(Object.values(ReturnBucket).map((b) => [b, 0])) as Record<ReturnBucket, number>;
  for (const row of filterReturns({ ebayAccountId: params.ebayAccountId ?? '' })) {
    counts[row.bucket] += 1;
  }
  return counts;
}

/* ── Template catalog ─────────────────────────────────────────────────── */

/** The real catalog, written by `scripts/build-template-previews.mjs`. */
const DEMO_TEMPLATE_CATALOG_URL = '/template-samples/catalog.json';

interface DemoTemplateCatalogEntry {
  slug: string;
  htmlContent: string;
  sampleData: Record<string, string | string[]>;
}

let demoTemplatesPromise: Promise<typeof DEMO_PREDEFINED_TEMPLATES> | null = null;

/**
 * The picker previews the REAL templates with their real sample products, from
 * the same static file the landing gallery is built with — the demo has no API,
 * and the placeholders alone would show an empty preview. Read once per page
 * load; if the file is unavailable the placeholders are served instead.
 */
function loadDemoPredefinedTemplates(): Promise<typeof DEMO_PREDEFINED_TEMPLATES> {
  demoTemplatesPromise ??= fetch(DEMO_TEMPLATE_CATALOG_URL)
    .then((response) => (response.ok ? (response.json() as Promise<DemoTemplateCatalogEntry[]>) : []))
    .then((entries) =>
      DEMO_PREDEFINED_TEMPLATES.map((template) => {
        const real = entries.find((entry) => entry.slug === template.slug);
        return real ? { ...template, htmlContent: real.htmlContent, sampleData: real.sampleData } : template;
      })
    )
    .catch(() => DEMO_PREDEFINED_TEMPLATES);
  return demoTemplatesPromise;
}

/* ── Router ───────────────────────────────────────────────────────────── */

export const demoBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args) => {
  const { path, method, params, body } = parseRequest(args);

  // A tiny delay keeps loading states visible, so the demo behaves like the
  // real app rather than snapping into place instantly.
  await new Promise((resolve) => setTimeout(resolve, 120));

  /* Session — the demo is "already signed in" as a sample seller. */
  if (path === '/auth/refresh') {
    return ok({ accessToken: 'demo-access-token', user: DEMO_USER });
  }
  if (path === '/auth/me') {
    return ok(DEMO_USER);
  }
  if (path === '/auth/logout') {
    return ok({ success: true });
  }

  /*
   * Bookkeeping writes the Messages page fires ON ITS OWN — the mark-read when
   * a thread is opened. The visitor did not ask to change anything, so they
   * answer silently: routing them through `demoWrite` would raise the "this is
   * a demo" notice the moment the page loads. They still persist nothing.
   */
  if (method !== 'GET' && /^\/ebay\/messages\/conversations\/[^/]+\/read$/.test(path)) {
    return ok({});
  }

  if (method !== 'GET') {
    return demoWrite(path, body);
  }

  if (path === '/dashboard') {
    const input: DashboardRangeInput =
      params.from && params.to
        ? { from: String(params.from), to: String(params.to) }
        : { preset: (params.range as DashboardRangePreset) || DEFAULT_DASHBOARD_RANGE_PRESET };
    return ok(buildDemoDashboard(input));
  }

  if (path === '/action-center') {
    const summary = buildDemoActionCenter();
    return ok(params.ebayAccountId ? scopeDemoActionCenter(summary, params.ebayAccountId) : summary);
  }

  if (path === '/ebay/accounts') {
    return ok(DEMO_EBAY_ACCOUNTS);
  }

  /*
   * Best Sellers is Amazon-side browsing; in the real app a miss costs the
   * seller's daily allowance and a proxy fetch. The demo answers every list,
   * category and page from the sample catalog so the page is always populated
   * and nothing is ever fetched.
   */
  if (path.startsWith('/best-sellers')) {
    const listType = BEST_SELLERS_LIST_TYPE_ORDER.includes(params.listType as BestSellersListType)
      ? (params.listType as BestSellersListType)
      : BestSellersListType.BEST_SELLERS;
    if (path === '/best-sellers/categories') {
      // One node's tree (the department list at the root), without its products.
      const node = buildDemoBestSellers(listType, params.category ?? '', 1);
      return ok({ outcome: node.outcome, categories: node.list?.categories ?? [] });
    }
    const page = Math.max(1, Number(params.page) || 1);
    return ok(buildDemoBestSellers(listType, params.category ?? '', page));
  }

  if (path === '/ebay/messages/unread-count') {
    return ok(buildDemoUnread());
  }

  if (path === '/ebay/messages/unread-breakdown') {
    return ok(buildDemoUnreadBreakdown());
  }

  if (path === '/ebay/messages/conversations') {
    return ok(paginate(filterConversations(params), params));
  }

  const conversationThread = /^\/ebay\/messages\/conversations\/([\w-]+)$/.exec(path);
  if (conversationThread) {
    const thread = demoThread(conversationThread[1]);
    return thread ? ok(thread) : { error: { status: 404, data: { message: 'Not found' } } };
  }

  if (path === '/listings') {
    const rows = filterListings(params);
    return ok({ ...paginate(rows, params), categories: DEMO_LISTING_CATEGORIES });
  }

  if (path === '/listings/products') {
    const search = params.search?.trim().toLowerCase();
    const rows = DEMO_LISTINGS.filter(
      (l) =>
        (!params.ebayAccountId || l.ebayAccountId === params.ebayAccountId) &&
        (!search || l.title.toLowerCase().includes(search) || l.asin.toLowerCase().includes(search))
    ).map((l) => ({
      id: l.productId,
      asin: l.asin,
      title: l.title,
      brand: l.brand,
      category: l.category,
      price: l.purchasePrice ?? 0,
      currency: 'USD',
      stock: l.sourceStock ?? 0,
      stockStatus: l.sourceStockStatus,
      imageUrls: l.imageUrls,
      listingCount: 1,
      updatedAt: l.updatedAt,
      createdAt: l.createdAt,
    }));
    return ok(paginate(rows, params));
  }

  if (path === '/listings/jobs') {
    const search = params.search?.trim().toLowerCase();
    let jobs = DEMO_LISTING_JOBS;
    if (search) {
      jobs = jobs.filter((j) => j.id.toLowerCase().includes(search));
    }
    if (params.status && params.status !== 'all') {
      jobs = jobs.filter((j) => String(j.status) === params.status);
    }
    if (params.ebayAccountId) {
      jobs = jobs.filter((j) => j.ebayAccountId === params.ebayAccountId);
    }
    return ok(paginate(jobs, params));
  }

  const jobItems = /^\/listings\/jobs\/([\w-]+)\/items$/.exec(path);
  if (jobItems) {
    return ok(demoJobItems(jobItems[1]));
  }

  const jobDetail = /^\/listings\/jobs\/([\w-]+)$/.exec(path);
  if (jobDetail) {
    const found = DEMO_LISTING_JOBS.find((j) => j.id === jobDetail[1]);
    return found ? ok(found) : { error: { status: 404, data: { message: 'Not found' } } };
  }

  const listingDetail = /^\/listings\/(demo-listing-[\w-]+)$/.exec(path);
  if (listingDetail) {
    const found = DEMO_LISTINGS.find((l) => l.id === listingDetail[1]);
    return found
      ? ok({ ...found, adCampaign: demoListingCampaign(found.id) })
      : { error: { status: 404, data: { message: 'Not found' } } };
  }

  const listingRevisions = /^\/listings\/(demo-listing-[\w-]+)\/revisions$/.exec(path);
  if (listingRevisions) {
    return ok(paginate(demoListingRevisions(listingRevisions[1]), params));
  }

  /* ── Ad campaigns (store-scoped by `ebayAccountId`; only store 1 advertises) ── */
  if (path === '/campaigns') {
    const campaigns = DEMO_CAMPAIGNS.filter((c) => c.ebayAccountId === params.ebayAccountId);
    return ok({ campaigns, eligibility: { status: 'ELIGIBLE', reason: null } });
  }
  if (path === '/campaigns/candidates') {
    return ok(demoCampaignCandidates(params));
  }
  const campaignDetail = /^\/campaigns\/(\d+)$/.exec(path);
  if (campaignDetail) {
    const detail = demoCampaignDetail(campaignDetail[1]);
    return detail ? ok(detail) : { error: { status: 404, data: { message: 'campaigns.errors.notFound' } } };
  }

  if (path === '/listings/revisions') {
    return ok(
      demoAllListingRevisions({
        page: Number(params.page) || undefined,
        limit: Number(params.limit) || undefined,
        search: params.search,
        ebayAccountId: params.ebayAccountId,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      })
    );
  }

  if (path === '/orders') {
    const rows = filterOrders(params);
    const { items, total } = paginate(rows, params);
    return ok({ orders: items, total });
  }

  if (path === '/orders/stage-counts') {
    return ok(countOrderStages(params));
  }

  if (path === '/orders/stats') {
    return ok(buildDemoOrderStats());
  }

  if (path === '/returns') {
    return ok(paginate(filterReturns(params), params));
  }

  if (path === '/returns/counts') {
    return ok(countReturnBuckets(params));
  }

  const returnDetail = /^\/returns\/(demo-return-[\w-]+)\/detail$/.exec(path);
  if (returnDetail) {
    const found = DEMO_RETURNS.find((r) => r.id === returnDetail[1]);
    return found ? ok(demoReturnDetail(found)) : { error: { status: 404, data: { message: 'Not found' } } };
  }

  if (path === '/cancellations') {
    return ok(paginate(filterCancellations(params), params));
  }

  if (path === '/cancellations/counts') {
    return ok(countCancellationBuckets(params));
  }

  const cancellationDetail = /^\/cancellations\/(demo-cancel-[\w-]+)\/detail$/.exec(path);
  if (cancellationDetail) {
    const found = DEMO_CANCELLATIONS.find((c) => c.id === cancellationDetail[1]);
    return found
      ? ok(demoCancellationDetail(found))
      : { error: { status: 404, data: { message: 'cancellations.errors.notFound' } } };
  }

  const orderDetail = /^\/orders\/(demo-order-[\w-]+)$/.exec(path);
  if (orderDetail) {
    const found = DEMO_ORDERS.find((o) => o.id === orderDetail[1]);
    return found
      ? ok({ ...found, timeline: demoOrderTimeline(found) })
      : { error: { status: 404, data: { message: 'Not found' } } };
  }

  /* ── Configuration surfaces ──────────────────────────────────────────
   * A seller three months in already has settings, buyer accounts, strategy
   * groups and message templates filled in. These endpoints exist so the
   * whole shell is walkable, not just the four reporting screens.
   */

  if (path === '/profile') {
    return ok(DEMO_PROFILE);
  }

  if (path === '/amazon/accounts') {
    return ok(DEMO_AMAZON_ACCOUNTS);
  }

  if (path === '/store-settings') {
    return ok(demoStoreSettingsFor(params.storeId));
  }

  if (path === '/store-settings/all') {
    return ok(DEMO_STORE_SETTINGS_ALL);
  }

  if (path === '/store-settings/buyer-messaging') {
    return ok(demoStoreSettingsFor(params.storeId).buyerMessaging ?? null);
  }

  if (path === '/buyer-messaging/templates') {
    const rows = params.eventType
      ? DEMO_BUYER_MESSAGE_TEMPLATES.filter((t) => String(t.eventType) === params.eventType)
      : DEMO_BUYER_MESSAGE_TEMPLATES;
    return ok(rows);
  }

  if (path === '/listing-settings-group/groups') {
    return ok(DEMO_LISTING_GROUPS);
  }

  const groupDetail = /^\/listing-settings-group\/groups\/([\w-]+)$/.exec(path);
  if (groupDetail) {
    const found = DEMO_LISTING_GROUPS.find((g) => g.id === groupDetail[1]);
    return found ? ok(found) : { error: { status: 404, data: { message: 'Not found' } } };
  }

  if (path === '/listing-settings-group/predefined-templates') {
    return ok(await loadDemoPredefinedTemplates());
  }

  if (path === '/ebay/business-policies') {
    return ok(DEMO_BUSINESS_POLICIES);
  }

  if (path === '/billing/catalog') {
    return ok(DEMO_BILLING_CATALOG);
  }

  if (path === '/billing/summary') {
    return ok(buildDemoBillingSummary());
  }

  // The "live billing page" reads these two straight from Stripe on every
  // load. In demo mode they are pure fixtures — and they must be mapped
  // explicitly rather than left to the catch-all: `/billing/invoices` does
  // not match the `list`-shaped regex below, so it would fall through to
  // `ok({})` and `InvoiceHistoryCard`'s `data.items.map(...)` would throw.
  if (path === '/billing/details') {
    return ok(buildDemoBillingDetails());
  }

  if (path === '/billing/invoices') {
    return ok(buildDemoBillingInvoices());
  }

  /*
   * These two are GETs that would hand the visitor a live external surface —
   * the provider's billing portal and eBay's OAuth consent screen. Both
   * callers guard on the URL being present (`if (result.portalUrl) …`), so
   * answering with an empty one is a clean no-op. Erroring instead would raise
   * the container's generic failure modal, which is the outcome to avoid.
   */
  if (path === '/billing/portal') {
    window.dispatchEvent(new CustomEvent(DEMO_READONLY_EVENT));
    return ok({ portalUrl: null });
  }

  if (path === '/ebay/connect-url') {
    window.dispatchEvent(new CustomEvent(DEMO_READONLY_EVENT));
    return ok({ url: '', state: '' });
  }

  /*
   * Anything not modelled above answers empty rather than erroring. A screen
   * the demo does not populate should render its own empty state, not a red
   * error banner that reads as a broken product.
   */
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info(`[demo] unmapped GET ${path} — returning an empty payload`);
  }
  if (/\b(accounts|templates|groups|policies|items|list)\b/.test(path)) {
    return ok([]);
  }
  return ok({});
};
