# Handoff — Ad Campaigns backend (2026-10-04)

Written for: the next AI session that picks this plan up.

## Prompt to give the next session

> Continue from the current `development` checkout. Tasks 1–9 are implemented; Tasks 1–5 are the historically deployed baseline, while Tasks 6–9 are development-only. Read this handoff, the backend plan, and the current task reports before proposing the next step. Do not deploy, push, or merge to UAT/main without the operator's instruction. Answer the operator in Turkish.

## Where it stands

| Task | Status | Commits |
|---|---|---|
| 1 — `sell.finances` default scope, panel switch removed | done, historically deployed | `1626bee6` |
| 2 — migration 143 (`ebay_campaigns`, listing ad columns, claim stamps) + `EbayApiResource.MARKETING_ADS` | done, historically deployed; stock Postgres chain check recorded | `b09f78e9` |
| 3 — shared campaign domain (`resolveAppliedAdRate`, `campaignReadOnlyReason`, `isValidBidPercentage`, DTOs) | done, historically deployed | `33fb3cb6` |
| 4 — ad-aware pricing (`calculateListingPrice(..., adRatePct)`, fan-out reads `listings.ad_rate_applied`) | done, historically deployed | `f966184e`, `0e3f39ee` |
| 5 — `EbayMarketingClient` + pure readers | done, historically deployed | `bba1d4a5` |
| 6 — campaign sweep (`ebay-campaign-sync`, fail-closed ad state, durable repricing) | implemented; development-only | `289f4bd7`, `596f5a2b` |
| 7 — write service + `/v1/campaigns` endpoints (gates, audit) | implemented; development-only | `fe0e7c22` |
| 8 — capture-only daily campaign report | implemented; development-only; needs a real report file before parser work | `1b4e3262` |
| 9 — remove legacy auto-promote code and update operator docs | implemented; scoped review pending; development-only | pending |

Only Tasks 1–5 are in the deployed baseline. Tasks 6–9 have not been deployed or merged to UAT/main. Migration 144 has been locally verified only and has not been applied in production. The current branch contains other work; preserve unrelated files and keep changes scoped to the active task.

## Rulings already made (keep them)

1. Tasks 6/7/8 list their test cases in prose — the implementer writes each as a real `it()` against fakes; the reviewer checks each exists.
2. Migration chain check: `docker/postgres/init.sql` has a pre-existing `CREATE EXTENSION vector` that stock Postgres lacks — filter that line for the check (pre-existing, not ours).
3. Margin-override listings (`listing-pricing.helpers.ts` margin branch) get no fees today, so they get no ad rate either — left unchanged on purpose and documented in CLAUDE.md. The future UI should communicate this behavior.
4. Pricing test gap was re-graded Important and fixed (`0e3f39ee`).

## Deferred minors (fold into Task 9 or the final review)

- `campaign-rules.ts` enum `as string` casts (lint `no-unsafe-enum-comparison`) are unexplained.
- `listing-pricing.ts` breakdown docs say the fee base is finalPrice; it is priceBeforeFloor when only the floor applied (pre-existing).
- Commit `1626bee6` swept in another session's staged `useListingsColumns.tsx` width tweaks (shared index) — harmless.

## Working rules the next session must follow

- Shared working tree with other sessions. Commit ONLY your files with an explicit pathspec: `git add <paths>` then `git commit -F msg -- <paths>`. Never `git add -A`, stash, reset, or unstage others' files. Rules file for implementers: `.superpowers/sdd/2026-10-04-ad-campaigns-backend/constraints.md` (git-ignored; recreate from this list if missing).
- Pre-commit runs `pnpm lint` over the whole repo; if another session's file fails it, wait — never `--no-verify`.
- Build `@repo/shared` before api tests; api tests: `pnpm --filter api exec jest <path>`.
- No production/UAT access or live eBay calls while developing this task.
- Commit footer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Operator-side facts from today

- Operator evidence: both production stores (sipastan, budagan) were re-consented with `sell.finances`. The capture-only billing sweep works (host fix `api.ebay.com`, commit `1c2540c8`). The Promoted Listings fee in eBay's billing activity is `feeType = FeePromotedListingFeature` ("Promoted Listings - General fee"), each line carries `orderId` + `listingId` + `amount` — input for spec C3.
- sipastan produces ~27k billing lines / 30 days (93 % $0 insertion fees): C3 must read incrementally, not re-read 30 days.
- The operator set `ebay.finances.billingSync.intervalHours` to 1 for testing; ask them to put it back to 4.
- Migration 144 is locally verified but production application is unverified; the Task 6–9 code has not been deployed.

## After this plan

Next plan: `2026-10-04-ad-campaigns-ui.md` (B7 UI on the ACTIVE store from the top bar, campaign pages, add/create drawers, listing-detail row, price-calculator what-if, `campaigns` i18n in 16 locales) + the B6 report parser once a `.tsv.gz` is captured. Then C3/C4 (ad fee into order profit).
