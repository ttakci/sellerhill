# Handoff — template sample products (WIP, branch `feature/landing-refresh`)

Task: replace the listing-template sample products (landing template gallery +
Settings → Listing Settings Group picker preview) with category-matched,
CC0 / public-domain, unbranded products. Delete this file when the task is done.

## Done (committed)

- **Photos**: `apps/web/public/template-samples/` — 11 × 640×640 JPEGs + `CREDITS.md`
  (licenses verified via the Commons API; rejected candidates listed there).
  New from Commons: `air-filter` (Auto Parts), `led-flashlight` (Outdoor),
  `knit-cardigan` (Apparel), `heart-soap` (Beauty), `slow-feeder-bowl` (Pet),
  `wooden-blocks` (Toys). Copied from `demo-products/`: `bluetooth-speaker`,
  `wireless-earbuds`, `bed-pillow` (= `memory-foam-pillow`), `kitchen-scale`, `yoga-mat`.
  Minimalist has no image.
- **Migration `apps/api/migrations/122_template_sample_products.sql`**: one
  `$template_samples$…$template_samples$` JSON literal (slug → sample_data),
  applied with `UPDATE … FROM jsonb_each(...)`. 073 untouched; id/created_at untouched.
- **Guard spec** (`predefined-templates.guard.spec.ts`): overlays 122's samples on
  073's; new tests — every catalog slug has a 122 sample, `main_image` is
  `/template-samples/*.jpg` and the file exists, `Brand: Unbranded`, no MPN/UPC/EAN.
- **`scripts/build-template-previews.mjs`**: reads samples from 122 and renders
  `renderListingTemplate(html, sampleData)` exactly like the drawer; also writes
  `apps/web/public/template-samples/catalog.json` for the demo.
- **Demo** (`demoBaseQuery.ts`): `/listing-settings-group/predefined-templates`
  now fetches `/template-samples/catalog.json` (real HTML + samples), falls back
  to the placeholders.
- **`ListingGroupDrawer.container.tsx`**: custom-template fallback sample uses
  `/template-samples/wireless-earbuds.jpg` + unbranded earbuds copy; i18n
  `listingSettingsGroup.sample.productTitle/Description` (en+tr) updated to match.

## Remaining (not yet run / done)

1. `pnpm install` was done in the old session; then:
   `pnpm --filter @repo/shared build` → `node scripts/build-template-previews.mjs`
   (regenerates `apps/web/public/landing-screens/templates/*.html` and writes
   `apps/web/public/template-samples/catalog.json`). Commit the outputs.
2. Verify:
   - `npx eslint --max-warnings 0 apps/web/src/features/landing apps/web/src/features/settings apps/web/src/features/demo`
   - `cd apps/web && npx tsc --noEmit -p . | grep -E "features/(landing|settings|demo)"`
   - `pnpm --filter api test -- predefined-templates`
   - Browser at 1440 and 375: landing template gallery; demo mode
     (`sessionStorage.sellerhill_demo=1`) Settings → Listing Settings Group
     template preview. Restart vite after adding `public/` files; use viewport
     screenshots (fullPage shows iframes blank).
3. Update CLAUDE.md bullets "Template previews are LIVE HTML" (now reads 122's
   samples + photos in `template-samples/`, demo reads `catalog.json`) and
   "Nothing the landing shows may carry a real brand" (template photos rule,
   Commons-API verification, no Pixabay/Unsplash/Pexels re-uploads, no AI images).
   Add migration `122` to the migrations table.
4. Commit + push `feature/landing-refresh`, then ASK the user before merging:
   development (ff-only) → UAT (`--no-ff -m "Merge branch 'development' into UAT"`)
   → main (`--no-ff -m "Merge branch 'development'"`), then back to feature branch.

Wikimedia rate-limits this container's egress heavily (429s); if more photos
are ever needed, pace API calls ~1 per few seconds with a descriptive User-Agent.
