# One active store for the whole seller app

**Status:** direction agreed with the operator in conversation (2026-10-04); this is the written design for review.
**Replaces:** the per-page store filters added through 2026-10-03 (commits `b5183930`, `a2f74b50`) and the store labels on cards/detail pages.

## 1. The model

The seller works on ONE eBay store at a time, chosen in ONE place: the top bar, next to the language menu. Every store-scoped screen shows that store, and every action (add listings, import, reply, return action, campaign…) goes to that store. This is the pattern of Easync, Shopify's store switcher and Seller Central's account switcher.

Pages that do not depend on a store look exactly as they do today, and show no store name. The switcher stays visible in the top bar on every page. These pages are:
- Billing
- Amazon accounts
- Listing settings groups
- Best Sellers
- Stores
- Profile

## 2. The active store

- **Where it lives:** an `ActiveStoreProvider` (web), mounted inside `AppLayout`. It exposes `{ activeStoreId, setActiveStore, stores }`.
- **How it is chosen,** in this order:
  1. `?store=` in the URL, when it names a connected store. This keeps deep links working.
  2. The last store the seller selected, from `localStorage` under a per-user key. This is a per-viewer convenience: wrapped in try/catch and never required.
  3. The first connected store (oldest `created_at`).
- **The URL is kept in step:** the provider writes `?store=` on store-scoped pages, so a copied link opens the same store.
- **The active store becomes unusable** (disconnected, or the switcher list changes): fall back to the next connected store.
- **No toast (as built, 2026-10-04):** the app mounts no toast provider, so the switcher's label is the signal that the store changed. The toasts named below were not built.
- **A link that points at another store** (Action Center row, e-mail, shared link): opening it switches the active store to the target and shows a toast ("Switched to sipastan"). The page never renders a record under the wrong store.
- **A detail page whose record belongs to another store:** for example an order of B opened while A is active. The page switches to B, with the same toast.
- **One connected store:** the switcher renders the store name only, as a label with no menu.

## 3. The switcher

- **Placement:** top bar, beside the language `Dropdown`. It is the app's own `Dropdown`, never a native select. On mobile it is the bottom-sheet variant.
- **Options:** the store label (`storeName || ebayUsername || sellerId`) plus that store's pending-action count, e.g. "sipastan · 2", taken from the per-store Action Center summaries. This is so work waiting on another store is never hidden.
- **The sidebar badges** (Action Center, Messages) show the ACTIVE store's counts.
- **Switching a store:**
  - closes any open drawer;
  - resets page-local state (selection, pagination, open thread);
  - RTK queries refetch, because their args include the store.

## 4. Screens

| Screen | Change |
|---|---|
| Dashboard, Action Center, Orders (list + detail), Messages, Returns, Listings (overview / all / drafts / detail / jobs / job detail / products / revision history) | The store filter is removed; the store comes from the active store. The Action Center loses its own store select (the switcher replaces it). |
| Add Listings drawer, Import existing listings drawer | The store field is removed; listings go to the active store. The drawer states it in its subtitle ("Adding to budagan"). Business policies load for the active store. |
| Store-settings drawers (Store Settings, Blacklist, buyer messaging, listing rules) | The scope select stays. It defaults to the ACTIVE store, and "All stores (global)" can be chosen. The drawer header states the scope being edited ("These settings apply to budagan only" / "…to all stores"). |
| Cards, table rows, detail facts | The store labels added on 2026-10-03 are removed. Everything on a store-scoped screen belongs to the active store. |

The API is unchanged: every endpoint already takes `ebayAccountId`. The web now always sends it on store-scoped calls. The Action Center's blank-store call (the all-stores total) stays only for the switcher's per-store counts.

## 5. Not in scope / decided against

- **An "All stores" view.** Not offered anywhere for now. If needed later, it would be a Dashboard-only option.
- **Persisting the choice server-side.** Not done: `localStorage` is enough, and losing it only falls back to the first store.

## 6. Tests and verification

- Vitest covers the resolution order (URL > remembered > first), the fallback when the active store disappears, and the cross-store link switch.
- Each store-scoped page sends `ebayAccountId` from the context (container tests or a source guard).
- Playwright run in demo mode (two demo stores), at desktop and 375 px:
  - switcher placement;
  - per-store counts;
  - a cross-store link switches the store;
  - drawers state their scope.
