# Listings Page Split + ListingCard Molecule — Design

**Date:** 2026-07-14
**Status:** Approved (pending spec review)
**Scope:** `apps/web` listings feature + `packages/ui` new molecule

## Goal

Split the single `/listings` page (currently toggling between a slider overview and a full table via local `viewMode` state) into two **separate routes** so that:

- The "Tümü" (View All) button changes the URL (navigates to `/listings/all`).
- Clicking the navbar "eBay Listeleri" always returns to the overview (different route → remount → slider resets). Today it does nothing because the same `/listings` path doesn't remount.
- `/listings/all` defaults to a **card grid** of all eBay listings (with a table toggle) and keeps the existing filter bar + table structure.

Additionally:

- Extract the carousel's compact card into a reusable **generic molecule** in `packages/ui` (`ListingCard`), used by both the carousel and the `/listings/all` grid.
- Bring `ListingCarousel` into compliance with the project's container/component/style/types split.
- Three small CSS fixes on the overview.

## Decisions (confirmed with user)

1. **Molecule is generic** — `ListingCard` takes primitive props, does **not** depend on `ListingDto` / `@repo/shared`. `packages/ui` keeps zero `@repo/shared` dependency. The feature maps `ListingDto` → molecule props.
2. **Two separate pages**, each with its own 4-file split (container/component/style/types). No single container deriving view from route.
3. **Navbar "eBay Listeleri" → `/listings` (overview).** The nav item is `active` for both `/listings` and `/listings/all` (but not `/listings/jobs`, `/listings/products`, `/listings/add`).

## Architecture

### Routing (`apps/web/src/App.tsx`)

Add one route under the `/:locale` + `AppLayout` group:

```
<Route path="listings" element={<ListingsOverviewPage />} />
<Route path="listings/all" element={<ListingsAllPage />} />   // NEW
<Route path="listings/jobs" ... />      // unchanged
<Route path="listings/jobs/:jobId" ... /> // unchanged
<Route path="listings/products" ... />   // unchanged
<Route path="listings/add" ... />        // unchanged
```

`ListingsPage` (the current single component) is removed; its responsibilities split into `ListingsOverviewPage` and `ListingsAllPage`.

### Overview page — `apps/web/src/features/listings/overview/`

```
ListingsOverviewPage.container.tsx   // useGetListingsQuery, add drawer, handlers
ListingsOverviewPage.component.tsx   // PageHeader + TwoColumnLayout (carousel + actions)
ListingsOverviewPage.style.ts        // TwoColumnLayout, SliderColumn, AddColumn, AddCardStack, ViewAllButton, etc.
ListingsOverviewPage.types.ts        // ListingsOverviewPageProps
```

Responsibilities:

- Fetch listings (`useGetListingsQuery`, `refetchOnMountOrArgChange: true`).
- Render `PageHeader` (title/subtitle with count) with a **"Add New Listing" primary button** in `actions` + `TwoColumnLayout`:
  - Left: `<ListingCarousel listings={...} onViewAll={() => localeNavigate('/listings/all')} showViewAll={listings.length > 3} />`
  - Right: `QuickActionCard` (add) + `SettingsCard` (other actions → jobs).
- **Sole owner of the add flow** — owns `AddListingsDrawer` + `onAddListing` / `onAddDrawerClose` / `handleAddSuccess` handlers (moved from the old container). On add success → `localeNavigate('/listings/jobs')`.
- `onViewJobs` → `localeNavigate('/listings/jobs')`.
- Wrapped in `EbayAccountGuard`.

The overview does **not** own filter/sort/pagination/columns/bulk logic — that moves to the `all` page.

### All page — `apps/web/src/features/listings/all/`

```
ListingsAllPage.container.tsx   // useGetListingsQuery, filters, sort, pagination, columns, bulk, view-mode
ListingsAllPage.component.tsx   // PageHeader + FilterBar + DataTable
ListingsAllPage.style.ts        // FilterBar, FilterBarRow, SearchWrapper, SelectWrapper, NumericFilterGrid, etc.
ListingsAllPage.types.ts        // ListingsAllPageProps (reuses ListingsFilterState, NumericRange)
```

Responsibilities (moved verbatim from the old `ListingsPageContainer`):

- `filters` state + `DEFAULT_FILTERS` + all `handle*Change` handlers + `hasActiveFilters` + `numericFilters`.
- `sortColumn` / `sortDirection` + `handleSort` + `sortedListings`.
- `page` / `rowsPerPage` + `paginatedListings`.
- `visibleColumnKeys` + `columnOptions` + `toggleColumn` + `allColumns` (column defs with `render`) + `filteredColumns`.
- `selectedListingIds` + `selectedRows` + `handleEndSelected` / `handleDeleteSelected` + `bulkActions`.
- `useEndListingsMutation` / `useDeleteListingsMutation` + success notifications.
- `handleDownload` (CSV).
- `categoryOptions` / `statusOptions`.
- **View mode** for the DataTable grid/table toggle: `const [tableView, setTableView] = useState<ViewMode>('grid')` — default `'grid'` (card grid). Passed as `viewMode` + `onViewModeChange` to `DataTable`.
- `renderGridCard` renders `<ListingCard orientation="vertical" {...mappedProps} />` (replaces the old `S.ListingCard`).
- `PageHeader` actions: **none** — the "Add New Listing" button lives only on the overview page. The `all` page has no add entry point (no drawer, no button). Its `PageHeader` shows title + subtitle (count) only.
- Wrapped in `EbayAccountGuard`.

`ListingsFilterState` and `NumericRange` types stay in `features/listings/ListingsPage.types.ts` **renamed** to `features/listings/listings-filter.types.ts` (or kept in a shared types file under `features/listings/`) since both the old `ListingsViewMode` is removed and the filter types are now only used by the `all` page. `ListingsViewMode = 'slider' | 'full'` is **deleted**.

### Shared

- `ListingCarousel` → `apps/web/src/features/listings/carousel/` (4-file split). Used only by the overview page.
- `AddListingsDrawer` (already exists at `features/listings/add-listings/drawer`) — imported **only by the overview page**.
- `ListingsFilterState` / `NumericRange` → `apps/web/src/features/listings/shared/listings-filter.types.ts` (or `features/listings/listings-filter.types.ts`).

### Molecule — `packages/ui/src/molecules/ListingCard/`

Stateless molecule (4 files: `.component.tsx` / `.style.ts` / `.types.ts` / `index.ts`; no container — it is stateless per the rules).

```
ListingCard.types.ts
ListingCard.component.tsx
ListingCard.style.ts
index.ts
```

**Props (generic, no `ListingDto`):**

```ts
export type ListingCardOrientation = 'horizontal' | 'vertical';
export type StatTone = 'default' | 'positive' | 'negative' | 'info';

export interface ListingCardStat {
  label: string;
  value: string;
  tone?: StatTone;
}

export interface ListingCardBadge {
  id: string;
  storeType: 'amazon' | 'ebay';   // delegates to IdBadge
  size?: 'sm' | 'md';
}

export interface ListingCardStatus {
  label: string;
  tone: 'active' | 'neutral';
}

export interface ListingCardProps {
  title: string;
  imageUrl?: string;
  brand?: string;
  primaryBadge?: ListingCardBadge;     // ASIN
  secondaryBadge?: ListingCardBadge;   // eBay listing id
  stats: ListingCardStat[];            // price, profit, roi, stock (grid) — flex
  status: ListingCardStatus;
  soldCount?: number;
  watchCount?: number;
  orientation: ListingCardOrientation;
  onClick?: () => void;
  className?: string;
}
```

- `orientation="horizontal"`: image left (fixed width), content right — used by the carousel.
- `orientation="vertical"`: image top (16:9), content below — used by the `/listings/all` grid.
- Markup uses existing atoms/molecules: `Icon` (image placeholder, sold/watch icons), `IdBadge`, `Badge`/`Text`. No `styled.h1` etc.
- All colors/spacing via `tkn()`. No hardcoded values.
- Exported from `packages/ui/src/molecules/index.ts` and the package barrel.

The feature maps `ListingDto` → `ListingCardProps` in a `useMemo` inside each consuming container (overview carousel container and `all` page container).

### Carousel refactor — `apps/web/src/features/listings/carousel/`

```
ListingCarousel.container.tsx   // recentListings (sort by createdAt, slice 3), slide state, next/prev/goToSlide
ListingCarousel.component.tsx   // markup: CarouselWrapper, ViewAll button, viewport, slides, arrows, pagination dots; renders <ListingCard orientation="horizontal" />
ListingCarousel.style.ts        // CarouselWrapper, CarouselViewport, CarouselSlide, CarouselArrow, CarouselPagination, PaginationDot, CarouselTopBar, SliderEmpty, SliderEmptyText
ListingCarousel.types.ts        // ListingCarouselProps
```

- Moves the carousel-mechanism styles out of `ListingsPage.style.ts`.
- The `Compact*` card styles are **deleted** from `ListingsPage.style.ts` — they now live inside the `ListingCard` molecule's `.style.ts`.
- `ListingCarousel` no longer imports `./ListingsPage.style`; it imports its own `./ListingCarousel.style` + `ListingCard` from `@repo/ui`.
- `onViewAll` is now a navigation callback (the overview container passes `() => localeNavigate('/listings/all')`).

### Navbar active state (`apps/web/src/layouts/AppLayout/AppLayout.component.tsx`)

The "eBay Listeleri" `NavItem` `$active` currently checks `pathWithoutLocale === '/listings'`. Change to:

```
$active={pathWithoutLocale === '/listings' || pathWithoutLocale === '/listings/all'}
```

So the item stays highlighted on the full-list page too, without matching `/listings/jobs`, `/listings/products`, `/listings/add`.

### Breadcrumb (`apps/web/src/layouts/AppLayout/AppLayout.container.tsx`)

Update the listings branch to handle `/listings/all`:

- `/listings` → `[{home}, {label: menu.ebayListings}]` (overview; second item optional — current code pushes nothing extra for plain `/listings`, keep as-is).
- `/listings/all` → `[{home}, {label: menu.ebayListings, path: '/listings'}, {label: listings.breadcrumb.allListings}]` (new "All Listings" crumb). Add i18n key `listings:listings.breadcrumb.allListings` (en + tr).

(`/listings/jobs`, `/listings/products`, `/listings/add` keep existing behavior.)

## CSS fixes (overview)

1. **Card height + bottom-border alignment.** The carousel card's bottom edge must sit on the same horizontal line as the right-side `other-actions` card's bottom border. Root cause: within `SliderColumn`, `CarouselTopBar` (View All button) + `CarouselViewport` (flex:1) + `CarouselPagination` stack, while in `AddCardStack`, `QuickActionCard` + `other-actions-card` (flex:1) stack; the two stacks share total height via `TwoColumnLayout { align-items: stretch }`, but the non-flex siblings (TopBar/Pagination vs QuickActionCard) have different heights, so the flex-1 regions (card vs other-actions) start at different y and the card bottom doesn't reach the other-actions bottom border.
   Fix approach (empirical, in `ListingCarousel.style.ts` + overview style):
   - Give `CarouselTopBar` and `CarouselPagination` compact, fixed heights matching the `QuickActionCard`'s contribution as closely as possible.
   - Increase `ListingCard` horizontal-orientation min-height by one spacing step (e.g. `min-height` token) so the card fills its viewport and its bottom edge aligns with the `other-actions` bottom border.
   - Verify with both themes.
2. **View All button hover underline.** Remove `text-decoration: underline;` from `ViewAllButton:hover` (was at `ListingsPage.style.ts:345`; relocates to overview `ViewAllButton` style). Only the color change remains on hover.

## i18n

Add (both `en` and `tr`):

- `listings:listings.breadcrumb.allListings` — "All Listings" / "Tüm Listeler"

(All other keys already exist: `listings.actions.viewAll`, `listings.overview.*`, `listings.filters.*`, `listings.table.*`, `listings.status.*`, `menu.ebayListings`.)

## File changes summary

**New:**
- `apps/web/src/features/listings/overview/ListingsOverviewPage.{container,component,style,types}.tsx`
- `apps/web/src/features/listings/all/ListingsAllPage.{container,component,style,types}.tsx`
- `apps/web/src/features/listings/carousel/ListingCarousel.{container,component,style,types}.tsx` + `index.ts`
- `apps/web/src/features/listings/shared/listings-filter.types.ts` (moved `ListingsFilterState`, `NumericRange`)
- `packages/ui/src/molecules/ListingCard/{ListingCard.component,ListingCard.style,ListingCard.types}.tsx` + `index.ts`

**Modified:**
- `apps/web/src/App.tsx` — add `listings/all` route, swap `ListingsPage` → `ListingsOverviewPage` / `ListingsAllPage` imports.
- `apps/web/src/features/listings/index.ts` — re-export new pages, drop old `ListingsPage`.
- `apps/web/src/layouts/AppLayout/AppLayout.component.tsx` — nav `$active` for `/listings/all`.
- `apps/web/src/layouts/AppLayout/AppLayout.container.tsx` — breadcrumb `/listings/all`.
- `packages/ui/src/molecules/index.ts` + `packages/ui/src/index.ts` — export `ListingCard`.
- i18n `en/tr` listings json — `breadcrumb.allListings`.

**Deleted:**
- `apps/web/src/features/listings/ListingsPage.{container,component,style,types}.tsx`
- `apps/web/src/features/listings/ListingCarousel.tsx` (replaced by the 4-file `carousel/`).

## Out of scope

- Backend / API changes (none).
- The `add-listings`, `listing-jobs`, `products` sub-pages (unchanged).
- Token-balance UI, Keepa pipeline (unrelated).
- Adding new filters or table columns (existing set preserved as-is).

## Risks / notes

- **Add flow is overview-only.** The `all` page has no "Add New Listing" button and does not mount `AddListingsDrawer`. Users add listings from the overview (button in `PageHeader` or the `QuickActionCard`).
- The CSS bottom-border alignment is empirical — exact token values will be tuned by eye in the running app during implementation.
- `ListingCard` generic props mean the `all`-page grid card will look slightly different from the current `S.ListingCard` (it adopts the compact card's visual language in vertical orientation). This is the intended unification.
