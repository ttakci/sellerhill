# Billing branch — remaining frontend defects (cleanup pass)

Backend commit read: `c3a3979` (see its `.superpowers/cleanup-backend-report.md` for the backend-side detail). Its FE-relevant contributions:
- `BillingDetailsDto.cancelAtPeriodEnd` / `cancelAt` — read live from Stripe.
- `nextChargeLine` already suppressed when `cancelAtPeriodEnd` is true; a new `cancelsAtPeriodEndLine` meta line was added and wired into `BillingPage.component.tsx`.
- `BillingScheduledChangeDto.planSlug` is now `string | null`; the container already branches to `scheduledChangeUnknownPlan` copy when null.

This pass addressed the six items still open on top of that.

## A — Dates omitting the year

`formatDate(dateString, locale, options?)` defaults to `{ day: 'numeric', month: 'short' }` (no year) — confirmed from `packages/ui/src/utils/format.ts`. `currentPeriodEndDisplay` already passed `{ day: 'numeric', month: 'short', year: 'numeric' }` explicitly.

Added a shared `BILLING_DATE_OPTIONS` constant (same shape) at the top of `BillingPage.container.tsx` and applied it to every other `formatDate` call in that file:
- `currentPeriodEndDisplay` (now reads the constant instead of an inline literal, for one definition instead of two copies of the same object).
- `nextChargeLine`'s date.
- `cancelsAtPeriodEndLine`'s date.
- `scheduledChangeLine`'s date, both branches (named plan and the null-planSlug fallback).
- `planChangeBody`'s `nextDate` and `date` (upgrade/downgrade dialog body).

All six now render day + short month + full year, consistent with the header meta line.

## B — Invoice list never sending `limit`

`getBillingInvoices` in `apps/web/src/features/billing/api/billing.api.ts` took `{ startingAfter?: string } | void` and only ever forwarded `startingAfter`. Extended the arg type to `{ startingAfter?: string; limit?: number } | void` and the `params` builder now includes `limit` whenever the caller supplies one, alongside `startingAfter`. No existing call site passes `limit` today (`InvoiceHistoryCard.container.tsx` only ever passes `{ startingAfter: cursor }` or `undefined`), so behavior for the current call sites is unchanged — the server's own default page size still governs unless a future caller opts in.

## C — Failed "Show more" wiping already-loaded invoices

`InvoiceHistoryCard.container.tsx`'s `isError` came straight from the CURRENT page's RTK Query result, and the component swapped the whole card for the error `EmptyState` on any `isError`, discarding the accumulated rows from a successful page one.

Fix:
- Container now derives `hasAccumulated = accumulated.length > 0` and splits the single `isError` into two props:
  - `isError` — `isError && !hasAccumulated` (nothing ever loaded → full-card error, unchanged behavior for that case).
  - `hasLoadMoreError` — `isError && hasAccumulated` (rows already on screen, a later page/retry failed).
- `InvoiceHistoryCard.component.tsx` renders the table + accumulated rows unconditionally once `hasAccumulated`; the load-more row now branches three ways: `hasLoadMoreError` → an inline `InfoMessage` with a "Try again" action (reusing the existing `retry` copy key) wired to the same `onRetry` (→ `refetch()`, which retries the SAME failed cursor page — not `onShowMore`, which would need `data.nextCursor` that doesn't exist after a failed fetch); else `hasMore` → the existing "Show more" button; else nothing.
- New style `LoadMoreErrorRow` (in `InvoiceHistoryCard.style.ts`) stretches the `InfoMessage` to the row's full width, mirroring `BillingPage.style.ts`'s `NoticeRow` pattern; the plain "Show more" button keeps its centered, content-sized look via the existing `MoreRow`.
- New i18n key `billing.invoices.showMoreError` added to both `en/billing.json` ("Couldn't load more invoices.") and `tr/billing.json` ("Daha fazla fatura yüklenemedi.").

Retry is reachable in both the full-error state (unchanged `EmptyState` retry action) and the load-more-error state (new inline retry).

## D — Cancel-at-period-end surface

Verified `c3a3979`'s "minimal FE line" claim: it added `cancelsAtPeriodEndLine` (rendered under the plan name in `semantic.warning`, bold) and correctly suppressed `nextChargeLine` when `cancelAtPeriodEnd` is true. That much was already solid.

What was still missing: the status badge (`statusBadgeVariant` + its label in `BillingPage.component.tsx`) is driven only by `subscriptionStatus`, which is our own DB-mirrored `BillingSummaryDto.subscription.status` — Stripe does NOT flip that to anything else when a seller cancels via the portal; it stays `active`/`trialing` until the period genuinely ends. So the badge kept reading plain "Active" directly beside the new warning line saying the opposite.

Chose the least-invasive correct treatment rather than reworking the status model:
- Added a `cancelAtPeriodEnd: boolean` prop to `BillingPageComponentProps`, sourced in the container from `Boolean(details?.cancelAtPeriodEnd)` (the same live-from-Stripe field the meta line already reads).
- `statusBadgeVariant(status, cancelAtPeriodEnd)` now returns `'warning'` instead of `'success'` when `cancelAtPeriodEnd` is true and the underlying status is `ACTIVE`/`TRIALING`. Every other status (`PAST_DUE`, `CANCELED`, `ENDED`) is untouched — those already read correctly and cancellation-at-period-end is not a state Stripe reports for them.
- The badge's label swaps to a new `billing.subscription.status.cancelling` key ("Cancelling" / "İptal ediliyor") under the same condition, instead of literally printing "Active" beside "Cancels on …".

This does not touch `BillingSummaryDto`, the badge's use elsewhere, or any other status derivation — it's a display-only override scoped to this one card, using data the backend commit already exposed. I judged reworking `subscriptionStatus` itself (e.g. inventing a synthetic status enum value) to be more ripple than this defect warrants, since `subscriptionStatus` is also used for `planMetaLine`'s renewal/access-ends label logic and touching its type would spread into that logic for no additional correctness gain — the meta line's wording (`nextRenewal`/`accessEnds`) is already keyed off `subscriptionStatus === ACTIVE` and remains accurate regardless (a cancelling-but-still-active subscription's access genuinely does still run to `currentPeriodEnd`).

## E — Scheduled-change fallback

Verified: `BillingScheduledChangeDto.planSlug` is `string | null` in `packages/shared/src/domain/billing/billing.wire.ts` (from `c3a3979`), and `BillingPage.container.tsx`'s `scheduledChangeLine` already branches — `!details.scheduledChange.planSlug` renders `billing.subscription.scheduledChangeUnknownPlan` ("Your plan changes on {{date}}" / "Paketiniz {{date}} tarihinde değişecek") instead of attempting `t('billing:billing.plans.null.name')` (which would have rendered the literal key or an empty string). Both locale keys already exist (`c3a3979` added them). No changes needed here — confirmed working as intended, no code change made.

## F — Overstated comment in App.tsx

Confirmed `BillingPage.container.tsx` reads neither `checkout` nor `session_id` (nor `topup`) from the URL anywhere — no `useSearchParams`/`URLSearchParams` in that file. The comment on the `/billing` redirect route claimed `preserveQuery` exists "so BillingPage can react to them," which is not true today.

Chose the honest-comment path over adding reactive handling: the page already re-fetches `summary`/`details` on every fresh mount (which a redirect-driven navigation is), so a completed checkout or top-up is reflected correctly without reading the query params at all — building a toast/banner keyed off `checkout=success` would be new user-facing behavior outside this ticket's scope ("fix a stale comment," not "add a post-checkout confirmation banner"). Reworded the comment to say the params are preserved so they aren't dropped by the redirect, and that `BillingPage` doesn't currently read them — the summary/details refetch on mount is what actually reflects the change.

## Verification

- `pnpm --filter @repo/shared build` — clean.
- `pnpm --filter web exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i billing` — empty.
- `pnpm --filter web exec eslint <all 9 touched files>` — clean, no output.
- `pnpm --filter api test` — 1032/1032 passed across 68 suites (unchanged from before this pass — shared types touched but no runtime shared code changed).
- JSON-validated both `en/billing.json` and `tr/billing.json` after edits.

## Nothing left unfixed

All six items (A–F) were addressed. Nothing was skipped or deferred further.

## Things worth a second look (not blockers)

- The new `cancelling` badge state and `showMoreError` inline retry are new UI states with no existing visual precedent in this codebase to copy pixel-for-pixel from; they reuse existing atoms (`Badge`, `InfoMessage`) and existing token/variant vocabulary, but were not visually verified in a running browser (no dev server was started for this pass — verification was tsc/eslint/jest only, per the task's stated verification list).
- `getBillingInvoices`'s new `limit` param is plumbed through but unused by any current call site — it satisfies item B's requirement ("let the caller pass an optional limit") without picking a page size, since the task did not ask for the invoice card to actually request a different page size, only for the capability to exist.
