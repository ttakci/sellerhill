# Handoff — Ad Campaigns backend (2026-10-04)

Written for: the next AI session that picks this plan up.

## Prompt to give the next session

> You are continuing the implementation of `docs/superpowers/plans/2026-10-04-ad-campaigns-backend.md` (spec: `docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md`, Part B) on branch `development`, using the superpowers **subagent-driven-development** skill (Sonnet implementers, Sonnet/Opus task reviewers, Opus final whole-branch review). Read this handoff file first, then the plan. Tasks 1–4 are DONE and reviewed. Task 5 is committed (`bba1d4a5`) but NOT yet task-reviewed — start by reviewing it, then do Tasks 6, 7, 8, 9, then the final whole-branch review over `17991f9a..HEAD`, then push `development`. Do NOT merge to UAT/main until the operator says so. Answer the operator in Turkish.

## Where it stands

| Task | Status | Commits |
|---|---|---|
| 1 — `sell.finances` default scope, panel switch removed | done, reviewed | `1626bee6` |
| 2 — migration 143 (`ebay_campaigns`, listing ad columns, claim stamps) + `EbayApiResource.MARKETING_ADS` | done, reviewed; chain applied clean on stock postgres:18-alpine | `b09f78e9` |
| 3 — shared campaign domain (`resolveAppliedAdRate`, `campaignReadOnlyReason`, `isValidBidPercentage`, DTOs) | done, reviewed | `33fb3cb6` |
| 4 — ad-aware pricing (`calculateListingPrice(..., adRatePct)`, fan-out reads `listings.ad_rate_applied`) | done, reviewed, 1 fix round | `f966184e`, `0e3f39ee` |
| 5 — `EbayMarketingClient` + pure readers | **committed, review pending** (implementer: 24 tests green, tsc + lint clean) | `bba1d4a5` |
| 6 — campaign sweep (`ebay-campaign-sync` queue, fail-closed ad state, reprice on change) | todo | |
| 7 — write service + `/v1/campaigns` endpoints (gates, audit) | todo | |
| 8 — capture-only daily campaign report | todo | |
| 9 — delete old auto-promote code; CLAUDE.md + `docs/ebay-reference/README.md` | todo | |

Everything above is pushed to `origin/development`. Nothing is merged to UAT/main. Nothing is deployed beyond what was there before (the API boots migration 143 on the next deploy of `development` → only when merged).

## Rulings already made (keep them)

1. Tasks 6/7/8 list their test cases in prose — the implementer writes each as a real `it()` against fakes; the reviewer checks each exists.
2. Migration chain check: `docker/postgres/init.sql` has a pre-existing `CREATE EXTENSION vector` that stock Postgres lacks — filter that line for the check (pre-existing, not ours).
3. Margin-override listings (`listing-pricing.helpers.ts` margin branch) get no fees today, so they get no ad rate either — left unchanged on purpose; Task 9 must document it in CLAUDE.md, and the UI plan must show it on the campaign page.
4. Pricing test gap was re-graded Important and fixed (`0e3f39ee`).

## Deferred minors (fold into Task 9 or the final review)

- Stale JSDoc of the deleted `EBAY_OAUTH_FINANCES_SCOPE_ENABLED` member in `packages/shared/src/domain/admin/platform-settings.types.ts`.
- CLAUDE.md still describes the finances switch and the OAuth `fin` state field ("eBay Finances: consent switch + billing capture") — rewrite in Task 9.
- `campaign-rules.ts` enum `as string` casts (lint `no-unsafe-enum-comparison`) are unexplained.
- `listing-pricing.ts` breakdown docs say the fee base is finalPrice; it is priceBeforeFloor when only the floor applied (pre-existing).
- Commit `1626bee6` swept in another session's staged `useListingsColumns.tsx` width tweaks (shared index) — harmless.

## Working rules the next session must follow

- Shared working tree with other sessions. Commit ONLY your files with an explicit pathspec: `git add <paths>` then `git commit -F msg -- <paths>`. Never `git add -A`, stash, reset, or unstage others' files. Rules file for implementers: `.superpowers/sdd/2026-10-04-ad-campaigns-backend/constraints.md` (git-ignored; recreate from this list if missing).
- Pre-commit runs `pnpm lint` over the whole repo; if another session's file fails it, wait — never `--no-verify`.
- Build `@repo/shared` before api tests; api tests: `pnpm --filter api exec jest <path>`.
- Production is read-only (SSH `sellerhill-prod`, DB as `claude_ro`, eBay GETs only). No eBay writes while developing.
- Commit footer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Operator-side facts from today

- Both production stores (sipastan, budagan) were re-consented with `sell.finances`. The capture-only billing sweep works (host fix `api.ebay.com`, commit `1c2540c8`). The Promoted Listings fee in eBay's billing activity is `feeType = FeePromotedListingFeature` ("Promoted Listings - General fee"), each line carries `orderId` + `listingId` + `amount` — input for spec C3.
- sipastan produces ~27k billing lines / 30 days (93 % $0 insertion fees): C3 must read incrementally, not re-read 30 days.
- The operator set `ebay.finances.billingSync.intervalHours` to 1 for testing; ask them to put it back to 4.
- Unverified: whether the SANDBOX keyset grants `sell.finances` (Task 1 put it in every consent) — check one sandbox connect on the test stack after the next deploy.

## After this plan

Next plan: `2026-10-04-ad-campaigns-ui.md` (B7 UI on the ACTIVE store from the top bar, campaign pages, add/create drawers, listing-detail row, price-calculator what-if, `campaigns` i18n in 16 locales) + the B6 report parser once a `.tsv.gz` is captured. Then C3/C4 (ad fee into order profit).
