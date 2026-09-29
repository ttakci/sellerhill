import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import {
  BEST_SELLERS_LIST_TYPE_ORDER,
  BestSellersListType,
  DashboardChartGranularity,
  EbayConversationDto,
  EbayConversationStatus,
  ListingStatus,
  OrderFulfillmentState,
  type ListingDto,
  type OrderDto,
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
  demoJobItems,
  demoListingRevisions,
  demoStoreSettingsFor,
  demoThread,
  DEMO_AMAZON_ACCOUNTS,
  DEMO_BILLING_CATALOG,
  DEMO_BUSINESS_POLICIES,
  DEMO_BUYER_MESSAGE_TEMPLATES,
  DEMO_CONVERSATIONS,
  DEMO_EBAY_ACCOUNTS,
  DEMO_LISTING_CATEGORIES,
  DEMO_LISTING_GROUPS,
  DEMO_LISTING_JOBS,
  DEMO_LISTINGS,
  DEMO_ORDERS,
  DEMO_PREDEFINED_TEMPLATES,
  DEMO_PROFILE,
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

function ok<T>(data: T): { data: T } {
  return { data };
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
        (o.buyerName ?? '').toLowerCase().includes(search)
    );
  }
  if (params.status && params.status !== 'all') {
    rows = rows.filter((o) => String(o.status) === params.status);
  }
  if (params.fulfillmentState && params.fulfillmentState !== 'all') {
    rows = rows.filter((o) => String(o.fulfillmentState) === params.fulfillmentState);
  }
  if (params.autoFulfillNeedsAttention === 'true') {
    rows = rows.filter(
      (o) => o.fulfillmentState === OrderFulfillmentState.ACTION_REQUIRED || o.amazonCancelledAt
    );
  }
  if (params.ebayAccountId) {
    // Sample orders are spread across both demo stores by listing index.
    rows = rows.filter((_, i) =>
      params.ebayAccountId === DEMO_EBAY_ACCOUNTS.items[1].id ? i % 4 === 0 : i % 4 !== 0
    );
  }
  if (params.dateFrom) {
    rows = rows.filter((o) => o.createdAt >= params.dateFrom);
  }
  if (params.dateTo) {
    rows = rows.filter((o) => o.createdAt <= `${params.dateTo}T23:59:59.999Z`);
  }

  return rows;
}

/* ── eBay Messages ────────────────────────────────────────────────────── */

/**
 * Mirrors the real endpoint's own contract: `type` is required, and `status`
 * carries the folder rail's meaning — `UNREAD` filters by unread count rather
 * than eBay's own `UNREAD` status, `ARCHIVE` matches the archived status, and
 * no `status` at all (the "All" folder) means the live `ACTIVE` set.
 */
function filterConversations(params: Record<string, string>): EbayConversationDto[] {
  let rows = DEMO_CONVERSATIONS.filter((conversation) => String(conversation.type) === params.type);

  if (params.status === String(EbayConversationStatus.UNREAD)) {
    rows = rows.filter((conversation) => conversation.unreadCount > 0);
  } else if (params.status === String(EbayConversationStatus.ARCHIVE)) {
    rows = rows.filter((conversation) => conversation.status === EbayConversationStatus.ARCHIVE);
  } else {
    rows = rows.filter((conversation) => conversation.status === EbayConversationStatus.ACTIVE);
  }

  return rows.sort((a, b) =>
    (b.latestMessage?.createdAt ?? b.createdAt).localeCompare(a.latestMessage?.createdAt ?? a.createdAt)
  );
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

export const demoBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args
) => {
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
   * Bookkeeping writes the Messages page fires ON ITS OWN — the unread recount
   * on page open and the mark-read when a thread is opened. The visitor did
   * not ask to change anything, so they answer silently: routing them through
   * `demoWrite` would raise the "this is a demo" notice the moment the page
   * loads. They still persist nothing.
   */
  if (method !== 'GET' && path === '/ebay/messages/refresh-unread') {
    return ok({ unread: buildDemoUnread().total });
  }
  if (method !== 'GET' && /^\/ebay\/messages\/conversations\/[^/]+\/read$/.test(path)) {
    return ok({});
  }

  if (method !== 'GET') {
    return demoWrite(path, body);
  }

  if (path === '/dashboard') {
    const granularity =
      (params.chartGranularity as DashboardChartGranularity) || DashboardChartGranularity.DAY;
    return ok(buildDemoDashboard(granularity));
  }

  if (path === '/action-center') {
    return ok(buildDemoActionCenter());
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
    const page = Math.max(1, Number(params.page) || 1);
    return ok(buildDemoBestSellers(listType, params.category ?? '', page));
  }

  if (path === '/ebay/messages/unread-count') {
    return ok(buildDemoUnread());
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
        !search ||
        l.title.toLowerCase().includes(search) ||
        l.asin.toLowerCase().includes(search)
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
    return found ? ok(found) : { error: { status: 404, data: { message: 'Not found' } } };
  }

  const listingRevisions = /^\/listings\/(demo-listing-[\w-]+)\/revisions$/.exec(path);
  if (listingRevisions) {
    return ok(paginate(demoListingRevisions(listingRevisions[1]), params));
  }

  if (path === '/orders') {
    const rows = filterOrders(params);
    const { items, total } = paginate(rows, params);
    return ok({ orders: items, total });
  }

  if (path === '/orders/stats') {
    return ok(buildDemoOrderStats());
  }

  const orderDetail = /^\/orders\/(demo-order-[\w-]+)$/.exec(path);
  if (orderDetail) {
    const found = DEMO_ORDERS.find((o) => o.id === orderDetail[1]);
    return found ? ok(found) : { error: { status: 404, data: { message: 'Not found' } } };
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
