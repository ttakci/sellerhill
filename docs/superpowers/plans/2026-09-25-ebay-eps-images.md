# eBay Picture Services Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve every image on a published listing — gallery and description — from eBay Picture Services instead of Amazon, and remove the Cloudflare R2 mirror it replaces.

**Architecture:** Each product image is uploaded once per eBay store through the Media API's `createImageFromUrl`; the returned `i.ebayimg.com` URLs are cached on a `(product, store)` row and fed into the single place `imageUrls` reaches eBay. Nothing is ever deleted — eBay expires unused EPS images itself, so the R2 garbage collector goes away with no replacement.

**Tech Stack:** TypeScript, NestJS, raw `pg`, Jest (CJS + ts-jest), eBay Media API v1_beta.

**Spec:** [docs/superpowers/specs/2026-09-25-ebay-eps-images-design.md](../specs/2026-09-25-ebay-eps-images-design.md)

## Global Constraints

- **Host is `https://apim.ebay.com/commerce/media/v1_beta`** for image operations — measured 2026-09-24 and confirmed by the OpenAPI `servers` block. `api.ebay.com` serves documents and `apiz.ebay.com` serves post-order documents; neither serves images.
- **Scope is `https://api.ebay.com/oauth/api_scope/sell.inventory`**, already in `EBAY_CONFIG.DEFAULT_SCOPES`. No OAuth change.
- **Rate limit: 50 POST requests per 5 seconds, per user.** Uploads are sequential per store and paced. A 429 is retried with backoff; it never fails the listing.
- **Do NOT add a daily quota figure for the Media image resource to `EbayCallBudgetService`.** `getRateLimits` reports no rate for `Image (commerce, v1_beta)` even after a successful upload. Inventing one would be exactly the guesswork this branch exists to remove.
- **The description's `main_image` is an EPS URL or the empty string — NEVER an Amazon URL.** The description is written once at publish and never revised. The gallery is different and does fall back per image, because eBay revises `imageUrls` on every price/stock sync.
- **An image never fails a listing.** Every upload path is fail-soft.
- **Never DELETE an EPS image** — the Media API has no such method for images, and eBay collects unused ones itself after 30 days.
- **An applied migration is never edited.** Next free number: `119`.
- After changing `packages/shared`, run `pnpm --filter @repo/shared build` before API tests.
- Verification: `pnpm --filter api test`, `pnpm lint`, `pnpm typecheck`.
- The pre-commit hook runs `pnpm lint --max-warnings 0`.
- Work on `development`. Do not create a branch, do not push.
- End every commit message with: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Review Focus

The inputs the spec implies but does not describe, ordered by how badly each would bite a seller.

1. **A product whose first image fails to upload but whose later images succeed.** The gallery must carry EPS URLs for the ones that worked and Amazon for the one that did not, while the description must render NO image rather than the Amazon one. Getting this backwards leaks the supplier permanently. Task 1.
2. **A product with zero usable images.** `resolveImageUrls` already substitutes `EBAY_PLACEHOLDER_IMAGE`; the EPS path must not break that, and must not upload the placeholder. Task 4.
3. **Two concurrent listing jobs for the same (product, store).** Both would upload the same images and race on the cache row. Wasted calls against a per-user rate limit, and a row that could end up half-written. Task 4.
4. **eBay returns 201 with a body that has no `imageUrl`.** The spec's D4 assumes the body may carry it; if it does not and the `Location` header is also missing, there is nothing to store and the image must fall back rather than storing `undefined`. Task 1.
5. **A store disconnected between upload and publish.** The cached EPS URLs belong to that seller's account; they must not be handed to a different store's listing. Task 4.

---

### Task 1: Pure EPS response helpers

Everything about reading eBay's answer, decided without a network call. The two Review Focus items about malformed responses live here.

**Files:**
- Create: `packages/shared/src/utils/ebay-eps.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/api/src/modules/ebay/ebay-eps.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `EBAY_EPS_IMAGE_BASE_URL = 'https://apim.ebay.com/commerce/media/v1_beta'`
  - `extractEpsImageId(location: string | null): string | null`
  - `readEpsImageUrl(body: string): string | null`
  - `isEpsImageUrl(url: string): boolean`
  - `resolveGalleryUrls(sourceUrls: string[], epsBySource: Map<string, string>): string[]`
  - `resolveDescriptionUrl(sourceUrls: string[], epsBySource: Map<string, string>): string`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/ebay/ebay-eps.spec.ts`:

```typescript
import {
  extractEpsImageId,
  isEpsImageUrl,
  readEpsImageUrl,
  resolveDescriptionUrl,
  resolveGalleryUrls,
} from '@repo/shared';

const EPS = 'https://i.ebayimg.com/00/s/MTM2OFgxMjMy/z/~sIAAeSwuiRqtYrb/$_1.JPG?set_id=8800005007';
const AMZ1 = 'https://images-na.ssl-images-amazon.com/images/I/9106K0FD50L.jpg';
const AMZ2 = 'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L.jpg';

describe('extractEpsImageId', () => {
  it('reads the id from the Location header', () => {
    expect(
      extractEpsImageId('https://apim.ebay.com/commerce/media/v1_beta/image/~sIAAeSwuiRqtYrb')
    ).toBe('~sIAAeSwuiRqtYrb');
  });

  it('tolerates a trailing slash', () => {
    expect(extractEpsImageId('https://apim.ebay.com/commerce/media/v1_beta/image/abc/')).toBe('abc');
  });

  it('returns null for a missing or unusable header', () => {
    expect(extractEpsImageId(null)).toBeNull();
    expect(extractEpsImageId('')).toBeNull();
    expect(extractEpsImageId('https://apim.ebay.com/commerce/media/v1_beta/image/')).toBeNull();
  });
});

describe('readEpsImageUrl', () => {
  it('reads imageUrl from a 201 body', () => {
    expect(readEpsImageUrl(JSON.stringify({ imageUrl: EPS, expirationDate: 'x' }))).toBe(EPS);
  });

  it('returns null when the body carries no imageUrl', () => {
    // eBay's OpenAPI declares ImageResponse on the 201, but the probe never saw
    // a populated body. Absence has to be survivable, not a crash.
    expect(readEpsImageUrl(JSON.stringify({ expirationDate: 'x' }))).toBeNull();
    expect(readEpsImageUrl('')).toBeNull();
    expect(readEpsImageUrl('not json')).toBeNull();
  });

  it('rejects an imageUrl that is not an EPS URL', () => {
    expect(readEpsImageUrl(JSON.stringify({ imageUrl: AMZ1 }))).toBeNull();
  });
});

describe('isEpsImageUrl', () => {
  it('accepts an i.ebayimg.com url', () => {
    expect(isEpsImageUrl(EPS)).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isEpsImageUrl(AMZ1)).toBe(false);
    expect(isEpsImageUrl('https://img.sellerhill.com/x.jpg')).toBe(false);
    expect(isEpsImageUrl('')).toBe(false);
    expect(isEpsImageUrl(undefined as unknown as string)).toBe(false);
  });
});

describe('resolveGalleryUrls', () => {
  it('uses EPS where available and the source where not', () => {
    // The gallery falls back per image: eBay revises imageUrls on every
    // price/stock sync, so a missing mirror there is correctable.
    const map = new Map([[AMZ2, EPS]]);
    expect(resolveGalleryUrls([AMZ1, AMZ2], map)).toEqual([AMZ1, EPS]);
  });

  it('preserves order', () => {
    const map = new Map([[AMZ1, EPS]]);
    expect(resolveGalleryUrls([AMZ1, AMZ2], map)).toEqual([EPS, AMZ2]);
  });

  it('returns an empty array for no source images', () => {
    expect(resolveGalleryUrls([], new Map())).toEqual([]);
  });
});

describe('resolveDescriptionUrl', () => {
  it('returns the EPS url for the FIRST image', () => {
    expect(resolveDescriptionUrl([AMZ1, AMZ2], new Map([[AMZ1, EPS]]))).toBe(EPS);
  });

  it('returns empty when the FIRST image has no EPS url, even if later ones do', () => {
    // The description is written once at publish and never revised, so it must
    // never fall back to Amazon — and must not silently promote image 2.
    expect(resolveDescriptionUrl([AMZ1, AMZ2], new Map([[AMZ2, EPS]]))).toBe('');
  });

  it('returns empty for no source images', () => {
    expect(resolveDescriptionUrl([], new Map())).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- ebay-eps`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/utils/ebay-eps.ts`:

```typescript
/**
 * Reading eBay Picture Services responses, and deciding which URL each surface
 * gets.
 *
 * The two surfaces deliberately behave differently. The GALLERY falls back per
 * image to the source URL, because eBay revises `imageUrls` on every price and
 * stock sync — a missing mirror there is correctable later. The DESCRIPTION
 * never falls back: it is written once at publish and never revised, so one
 * Amazon URL there names the supplier for the life of the listing.
 */

/** Image operations only. Documents are on api.ebay.com, post-order on apiz. */
export const EBAY_EPS_IMAGE_BASE_URL = 'https://apim.ebay.com/commerce/media/v1_beta';

const EPS_HOST = 'https://i.ebayimg.com/';

/** An EPS URL, as opposed to a source URL we merely handed to eBay. */
export function isEpsImageUrl(url: string): boolean {
  return typeof url === 'string' && url.startsWith(EPS_HOST);
}

/**
 * The image id from a 201's `Location` header, which eBay documents as
 * `https://apim.ebay.com/commerce/media/v1_beta/image/{image_id}`.
 */
export function extractEpsImageId(location: string | null): string | null {
  if (typeof location !== 'string' || location.length === 0) {
    return null;
  }
  const id = location.split('/').filter(Boolean).pop();
  return id && !id.includes(':') ? id : null;
}

/**
 * The EPS URL from a create-or-get response body.
 *
 * eBay's OpenAPI declares `ImageResponse` on the 201, which would make
 * `getImage` unnecessary — but the live probe did not print the body, so this
 * returns null rather than assuming. A caller that gets null falls back to
 * `getImage`. A body carrying something that is not an EPS URL is treated as
 * absent: storing a non-EPS value would defeat the whole feature.
 */
export function readEpsImageUrl(body: string): string | null {
  if (typeof body !== 'string' || body.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(body) as { imageUrl?: unknown };
    return typeof parsed.imageUrl === 'string' && isEpsImageUrl(parsed.imageUrl)
      ? parsed.imageUrl
      : null;
  } catch {
    return null;
  }
}

/** Gallery URLs: EPS where we have it, the source URL where we do not. */
export function resolveGalleryUrls(sourceUrls: string[], epsBySource: Map<string, string>): string[] {
  return (sourceUrls ?? []).map((source) => epsBySource.get(source) ?? source);
}

/**
 * The description URL: the FIRST image's EPS URL, or nothing.
 *
 * Deliberately not "the first image that happens to have one" — the
 * description shows the product's primary image, and quietly promoting image
 * two would change what the listing shows without anyone asking.
 */
export function resolveDescriptionUrl(sourceUrls: string[], epsBySource: Map<string, string>): string {
  const first = (sourceUrls ?? [])[0];
  if (!first) {
    return '';
  }
  return epsBySource.get(first) ?? '';
}
```

Add to `packages/shared/src/index.ts`, beside the other `utils` re-exports:

```typescript
export * from './utils/ebay-eps';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- ebay-eps`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/ebay-eps.ts packages/shared/src/index.ts apps/api/src/modules/ebay/ebay-eps.spec.ts
git commit -m "$(cat <<'EOF'
feat(shared): read EPS responses and decide each surface's image URL

The gallery falls back per image to the source URL because eBay revises
imageUrls on every price and stock sync, so a missing mirror there is
correctable. The description never falls back: it is written once at publish and
never revised, so one Amazon URL names the supplier for the life of the listing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: The `(product, store)` image cache table

EPS images belong to a seller's account while `products` is a shared ASIN cache, so the same ASIN listed by two stores needs two uploads. This table is what stops the third, fourth and hundredth listing of that product in that store paying for them again.

**Files:**
- Create: `apps/api/migrations/119_product_ebay_images.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `product_ebay_images (product_id, ebay_account_id, image_urls, uploaded_at)`.

- [ ] **Step 1: Write the migration**

Create `apps/api/migrations/119_product_ebay_images.sql`:

```sql
-- EPS image URLs, per product per eBay store.
--
-- Every image on a published listing used to be served from Amazon — the
-- gallery as well as the description — so the supplier's domain sat in the page
-- source of every live listing. Each product image is now uploaded once to eBay
-- Picture Services and the returned i.ebayimg.com URL is used for both.
--
-- The key is (product, store) and not product alone because an EPS image
-- belongs to the seller's own eBay account, while `products` is a shared
-- ASIN-keyed cache. Two stores listing the same ASIN genuinely need two
-- uploads; the same store listing it a second time needs none.
--
-- `image_urls` is ordered and positional: entry N is the EPS URL for the Nth
-- entry of `products.image_urls`. An empty string means that image failed to
-- upload — the gallery falls back to the source URL for it, and if it is the
-- first entry the description renders no image at all.
--
-- Nothing deletes rows here on a schedule. The Media API has no delete method
-- for images and eBay expires unused ones itself after 30 days, so there is no
-- orphan to collect; the ON DELETE CASCADEs below are the whole lifecycle.

CREATE TABLE IF NOT EXISTS product_ebay_images (
    product_id       UUID        NOT NULL REFERENCES products(id)       ON DELETE CASCADE,
    ebay_account_id  UUID        NOT NULL REFERENCES ebay_accounts(id)  ON DELETE CASCADE,
    image_urls       JSONB       NOT NULL,
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, ebay_account_id)
);
```

- [ ] **Step 2: Verify against a stock Postgres**

Replay every migration in order against a clean `postgres:18-alpine`, per CLAUDE.md's recipe:

```bash
docker run -d --name eps-migrate-test -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb -p 55433:5432 postgres:18-alpine
sleep 5
docker exec -i eps-migrate-test psql -U postgres -d testdb -c "CREATE ROLE sellerhill_user LOGIN;"
for f in apps/api/migrations/*.sql; do
  docker exec -i eps-migrate-test psql -v ON_ERROR_STOP=1 -U postgres -d testdb < "$f" || { echo "FAILED: $f"; break; }
done
docker exec -i eps-migrate-test psql -U postgres -d testdb -c "\d product_ebay_images"
```

Expected: every file applies, and the table exists with the composite primary key and both foreign keys.

- [ ] **Step 3: Tear down**

```bash
docker rm -f eps-migrate-test
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/migrations/119_product_ebay_images.sql
git commit -m "$(cat <<'EOF'
feat(listings): cache EPS image URLs per product per store

An EPS image belongs to the seller's own eBay account while products is a
shared ASIN cache, so two stores listing one ASIN genuinely need two uploads —
and the same store listing it again needs none. Nothing collects these rows on
a schedule: eBay has no delete method for images and expires unused ones itself.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `EbayMediaService` — the upload client

One image in, one EPS URL or null out. Knows nothing about products, stores or listings.

**Files:**
- Create: `apps/api/src/modules/ebay/ebay-media.service.ts`
- Test: `apps/api/src/modules/ebay/ebay-media.service.spec.ts`
- Modify: `apps/api/src/modules/ebay/ebay.module.ts`

**Interfaces:**
- Consumes: Task 1's helpers; `EbayService.getAccountAccessToken(accountId)`.
- Produces: `EbayMediaService.uploadFromUrl(accountId: string, sourceUrl: string): Promise<string | null>` — never throws.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/ebay/ebay-media.service.spec.ts`. Cover exactly these cases, each asserting real behaviour rather than that a mock was called:

- a 201 whose body carries an EPS `imageUrl` returns it and makes **no** `getImage` call
- a 201 whose body is empty falls back to `getImage` and returns its `imageUrl`
- a 201 with neither a usable body nor a `Location` header returns `null`
- a 400 (eBay could not download the URL, error `190204`) returns `null`
- a 403 returns `null`
- `fetch` rejecting returns `null` rather than throwing
- a 429 is retried and succeeds on the second attempt

Build the service with a fake `EbayService` returning a fixed token and a stubbed `global.fetch`, following the shape `image-mirror.service.spec.ts` already uses in this repo.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- ebay-media.service`
Expected: FAIL — the service does not exist.

- [ ] **Step 3: Write the service**

`uploadFromUrl` must:

1. Refuse a non-`https` source URL before any call — eBay rejects plain http, so spending a request to learn that is waste.
2. `POST {EBAY_EPS_IMAGE_BASE_URL}/image/create_image_from_url` with `{ imageUrl }`, `Content-Type: application/json`, `Authorization: Bearer <account token>`.
3. On 201: `readEpsImageUrl(body)` first; if null, `extractEpsImageId(location)` then `GET {base}/image/{id}` and read `imageUrl` from that. Log which path ran — the answer to the spec's D4 is a log line away and nobody should have to guess again.
4. On 429: retry with backoff, bounded, honouring `Retry-After` when present. The documented limit is 50 POSTs per 5 seconds per user, so a short wait genuinely clears it.
5. On any other non-201, or any throw: log at `warn` with eBay's `errorId` when the body carries one, and return `null`.

Wrap the whole body in try/catch so the method cannot throw. Export `EbayMediaService` from `EbayModule`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- ebay-media.service`
Expected: PASS, all seven cases.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ebay/ebay-media.service.ts apps/api/src/modules/ebay/ebay-media.service.spec.ts apps/api/src/modules/ebay/ebay.module.ts
git commit -m "$(cat <<'EOF'
feat(ebay): upload one image to eBay Picture Services

Reads the EPS URL from the 201 body when eBay populates it and falls back to
getImage when it does not, logging which path ran — the OpenAPI declares
ImageResponse on the 201 but the live probe never printed the body, and one log
line settles it for good. Never throws: a picture must not fail a listing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `EbayImageResolver` — the cache and the upload decision

Turns a product's source URLs into the two things the listing needs. This is where Review Focus items 2, 3 and 5 live.

**Files:**
- Create: `apps/api/src/modules/ebay/ebay-image-resolver.service.ts`
- Test: `apps/api/src/modules/ebay/ebay-image-resolver.service.spec.ts`
- Modify: `apps/api/src/modules/ebay/ebay.module.ts`

**Interfaces:**
- Consumes: `EbayMediaService.uploadFromUrl` (Task 3), Task 1's helpers, `DatabaseService` (at `../../common/database/database.service`).
- Produces: `EbayImageResolver.resolve(productId, ebayAccountId, sourceUrls): Promise<{ galleryUrls: string[]; descriptionUrl: string }>` — never throws.

- [ ] **Step 1: Write the failing tests**

Create the spec covering:

- a cached row returns its URLs and performs **no** upload
- a cache miss uploads each source image once and stores the result
- a partial failure stores an empty string in that position, returns the source URL in the gallery for it, and returns `''` for the description when it is the first image
- an empty `sourceUrls` returns `{ galleryUrls: [], descriptionUrl: '' }` without touching the database or the uploader
- a database failure returns the source URLs unchanged rather than throwing
- `sourceUrls` longer than `EBAY_MAX_IMAGES` uploads only the first 24

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- ebay-image-resolver`
Expected: FAIL — the service does not exist.

- [ ] **Step 3: Write the service**

`resolve` must:

1. Return `{ galleryUrls: [], descriptionUrl: '' }` immediately for empty input, without a query. `resolveImageUrls` in `ebay-listing-payload.ts` already substitutes `EBAY_PLACEHOLDER_IMAGE` downstream and must keep doing so — **never upload the placeholder.**
2. Read `product_ebay_images` for `(productId, ebayAccountId)`. On a hit whose stored array is the same length as `sourceUrls`, use it.
3. On a miss, take a **Postgres advisory lock keyed on the (product, store) pair** before uploading, then re-read inside the lock. Two concurrent listing jobs for the same product and store would otherwise both upload every image — wasted calls against a per-user rate limit, and a race on the row. This is the same shape `resolveProductData` already uses for its per-ASIN Keepa lock.
4. Upload the first `EBAY_MAX_IMAGES` source URLs **sequentially**, not with `Promise.all`. The limit is 50 POSTs per 5 seconds per user and the point is to stay under it, not to discover it.
5. Store the result with `INSERT … ON CONFLICT (product_id, ebay_account_id) DO UPDATE`, writing `''` for each image that failed.
6. Build the return with `resolveGalleryUrls` / `resolveDescriptionUrl` from Task 1 — do not re-implement that decision here.

Wrap everything in try/catch: a failure returns `{ galleryUrls: sourceUrls, descriptionUrl: '' }`, which is today's behaviour for the gallery and no image for the description.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- ebay-image-resolver`
Expected: PASS, all six cases.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ebay/ebay-image-resolver.service.ts apps/api/src/modules/ebay/ebay-image-resolver.service.spec.ts apps/api/src/modules/ebay/ebay.module.ts
git commit -m "$(cat <<'EOF'
feat(ebay): resolve a product's images to EPS URLs, once per store

Uploads behind a per-(product, store) advisory lock so two concurrent jobs
cannot both upload every image against a per-user rate limit, and sequentially
rather than in parallel because staying under that limit is the point. A failure
falls back to the source URL for the gallery and to no image for the
description.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire EPS into the one place images reach eBay

`listing-strategy.service.ts:145` sets `ListingCreationData.imageUrls` from `product.imageUrls`, and `ebay-listing-payload.ts:72` turns that into the gallery. Both create and draft-publish go through it, so there is exactly one seam.

**Files:**
- Modify: `packages/shared/src/domain/products/product-data.types.ts` — `mainImageMirroredUrl` becomes `mainImageUrl`
- Modify: `apps/api/src/modules/listings/listing-processor.service.ts`
- Modify: `apps/api/src/modules/listings/listing-strategy.service.ts`
- Modify: `apps/api/src/modules/listings/listings.module.ts`
- Test: `apps/api/src/modules/listings/listing-processor-eps.spec.ts`

**Interfaces:**
- Consumes: `EbayImageResolver.resolve` (Task 4).
- Produces: `productData.imageUrls` carrying gallery URLs and `productData.mainImageUrl` carrying the description URL, both set before `prepareListingData` is called.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/listings/listing-processor-eps.spec.ts` for an exported `attachEpsImages(resolver, productId, ebayAccountId, product)` helper, mirroring the shape of the existing `listing-processor-image.spec.ts`:

- sets `imageUrls` to the resolver's gallery URLs and `mainImageUrl` to its description URL
- leaves both untouched when the product has no images
- never throws when the resolver rejects

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test -- listing-processor-eps`
Expected: FAIL — `attachEpsImages` is not exported.

- [ ] **Step 3: Implement and wire**

Add the exported `attachEpsImages` helper at module scope in `listing-processor.service.ts`, replacing `attachMirroredImage`. Call it in `processListingBatch` **between** `resolveProductData` and `prepareListingData` — that is the only point where the product and the store are both in hand:

```typescript
const { productData, productId } = await this.resolveProductData(item.asin, userId);
await attachEpsImages(this.ebayImages, productId, ebayAccountId, productData);
const listingData = await this.listingStrategyService.prepareListingData(/* … */);
```

Do the same on the draft-publish path, which prepares each draft against a known eBay account.

In `product-data.types.ts`, rename `mainImageMirroredUrl` to `mainImageUrl` and update its comment to describe EPS rather than the mirror. In `listing-strategy.service.ts`, change the template context to `mainImageUrl: product.mainImageUrl`. Inject `EbayImageResolver` and add `EbayModule` to `ListingsModule.imports` if it is not already there.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test && pnpm typecheck`
Expected: PASS. Note that `ts-jest` does not type-check call arguments the way `tsc` does, so the full suite matters as much as the typecheck.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain/products/product-data.types.ts apps/api/src/modules/listings apps/api/src/modules/ebay
git commit -m "$(cat <<'EOF'
feat(listings): publish gallery and description images from EPS

listing-strategy.service.ts is the single place imageUrls reaches eBay, and both
create and draft publish go through it, so the resolver attaches there — between
resolveProductData and prepareListingData, the one point where the product and
the store are both in hand.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Remove the R2 mirror

It solved one image of twenty-five and is now replaced. Keeping it would mean two systems doing one job.

**Files:**
- Delete: `apps/api/src/modules/image-mirror/` (service, GC service, module, pure helper, all specs)
- Delete: `apps/api/src/scripts/mirror-product-images.ts`
- Delete: `packages/shared/src/utils/product-image.ts` and `apps/api/src/modules/listings/product-image.spec.ts`
- Create: `apps/api/migrations/120_drop_image_mirror_columns.sql`
- Modify: `apps/api/package.json` (drop `mirror:images`, drop `@aws-sdk/client-s3`), `packages/shared/src/index.ts`, `apps/api/.env.example`, `docker-compose.production.yml`, `docker-compose.test.yml`, `apps/api/src/modules/admin/admin.service.ts`, `apps/api/src/modules/admin/admin.controller.ts`, `apps/api/src/modules/admin/admin.module.ts`, `apps/api/src/modules/listings/listings.module.ts`, `apps/api/src/modules/listings/listings.service.ts`

**Interfaces:**
- Consumes: Task 5 having removed the last reader of `mainImageMirroredUrl`.
- Produces: no R2 surface anywhere.

- [ ] **Step 1: Write the migration**

Create `apps/api/migrations/120_drop_image_mirror_columns.sql` dropping `products.image_mirrored_at` and `products.mirrored_image_name`, with a header explaining that the Cloudflare R2 mirror they served was replaced by eBay Picture Services, which needs no watermark because eBay owns the storage and expires unused images itself. Migrations `116`, `117` and `118` are not edited.

- [ ] **Step 2: Remove the code**

Delete the files listed above. Remove `image-mirror-gc` from `ADMIN_QUEUE_NAMES`, from `OBSERVED_QUEUE_NAMES`, from `AdminModule`'s `BullModule.registerQueue`, and its `@InjectQueue` and `queues()` entry in `AdminController`. Remove the five R2 variables from `.env.example` and both compose files. Remove `image_mirrored_at` and `mirrored_image_name` from the row interfaces and SELECT lists in `listings.service.ts`.

Run `pnpm --filter api remove @aws-sdk/client-s3`.

- [ ] **Step 3: Verify nothing references it**

Run: `grep -rni "image-mirror\|imageMirror\|R2_\|IMAGE_CDN\|mirroredImageName\|image_mirrored_at\|mirror:images" apps packages docker-compose*.yml --include=*.ts --include=*.json --include=*.yml --include=*.sql | grep -v "migrations/11[678]_"`

Expected: only the three historical migrations, which are never edited. Anything else is a leftover.

- [ ] **Step 4: Verify the migration and the suite**

Run the stock-Postgres replay from Task 2 (through `120`), confirm both columns are gone, tear the container down. Then `pnpm --filter api test && pnpm lint && pnpm typecheck`.

Note that `admin-queue-coverage.guard.spec.ts` ties `queues()` to `ADMIN_QUEUE_NAMES` in both directions, so it fails until `image-mirror-gc` is removed from every one of the three places. That is the guard working.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(listings): remove the Cloudflare R2 image mirror

It closed one image of twenty-five: it was built on the belief that eBay
re-hosts gallery images, which was false. EPS serves both surfaces now, and
keeping R2 alongside it would only mean two systems doing one job — it was never
a fallback for EPS, since both render no image rather than an Amazon URL when
they have nothing.

The garbage collector goes with it and nothing replaces it: the Media API has no
delete method for images and eBay expires unused ones itself after 30 days.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Guard specs

Every invariant here reverts silently — a fallback to an Amazon URL still renders a picture, and a re-introduced delete still passes every test.

**Files:**
- Delete: `apps/api/src/modules/listings/image-mirror-invariants.guard.spec.ts`
- Create: `apps/api/src/modules/ebay/eps-image-invariants.guard.spec.ts`

**Interfaces:**
- Consumes: the sources from Tasks 1, 3, 4 and 5.
- Produces: nothing.

- [ ] **Step 1: Write the guard spec**

Following the established source-grep style of `listing-invariants.guard.spec.ts` — including its `methodBody` helper and its CRLF normalisation — assert:

1. `resolveDescriptionUrl` returns the empty string rather than a source URL when the first image has no EPS entry. Grep its body for the absence of a `?? first` style fallback.
2. `listing-strategy.service.ts`'s `processDescriptionTemplate` passes `mainImageUrl: product.mainImageUrl` and does not pass `product.imageUrls` — scoped to that method body, because the gallery line at `listing-strategy.service.ts:145` legitimately does.
3. **No delete call against the Media API exists anywhere.** Grep `apps/api/src` for `DeleteObject`, and for a `method: 'DELETE'` against `EBAY_EPS_IMAGE_BASE_URL`. eBay has no such endpoint for images; code that tries would fail at runtime and look like an outage.
4. `EbayMediaService.uploadFromUrl` cannot throw — its body is wrapped in try/catch.
5. No R2 or image-mirror identifier survives outside the three historical migrations.

Each assertion carries a comment saying what breaks if the invariant reverts, not just what the rule is.

- [ ] **Step 2: Run it**

Run: `pnpm --filter api test -- eps-image-invariants`
Expected: PASS.

- [ ] **Step 3: Prove a guard fails when its invariant breaks**

Temporarily make `resolveDescriptionUrl` fall back to the source URL, confirm guard 1 FAILS, then revert. Report what you saw; do not commit the probe. A guard nobody has seen fail is a guard nobody should trust.

- [ ] **Step 4: Run everything and commit**

Run: `pnpm --filter api test && pnpm lint && pnpm typecheck`

```bash
git add apps/api/src/modules/ebay/eps-image-invariants.guard.spec.ts
git rm apps/api/src/modules/listings/image-mirror-invariants.guard.spec.ts
git commit -m "$(cat <<'EOF'
test(ebay): lock the EPS image invariants

These revert silently — a fallback to an Amazon URL still renders a picture, and
a re-introduced delete still passes every behavioural test — so they are
source-greps. Includes a guard that no delete call against the Media API exists:
eBay has no such endpoint for images, so code attempting one would fail at
runtime and read as an outage.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite section 1b**

Replace the listing-image-mirror section with one describing EPS, in CLAUDE.md's established voice — why a decision was made and what breaks if it is reverted, not what the code does. Cover: both surfaces served from `i.ebayimg.com`; the host being `apim.ebay.com` while documents are elsewhere; the `(product, store)` key and why it is not product alone; that nothing deletes and why; the per-user 50-per-5-seconds limit; that no daily figure exists for the image resource and none may be invented; and that the description never falls back to Amazon while the gallery does.

**Keep the correction record.** The section currently documents that the gallery was wrongly believed safe and why that belief formed — evidence read from a hand-made listing. That history is the most useful part of the section for a future reader and must survive the rewrite.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: document eBay Picture Services as the image source

Keeps the record of why the gallery was wrongly believed safe — evidence read
from a hand-made listing rather than one this system published — because that
is the most useful part of the section for whoever reads it next.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## After the plan

The spec's "Before go-live" steps are operator work and are not tasks here:

1. Publish one listing and confirm both the gallery and the description image resolve to `i.ebayimg.com`.
2. Re-read `getImage` for one of those images and record what happened to `expirationDate` — the verification for the spec's risk 1.
3. Re-run `ebay:limits-probe --api-name image` once real upload volume exists.
4. Only then remove the Cloudflare bucket and the `img.sellerhill.com` custom domain.
