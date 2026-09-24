# Listing Image Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the eBay description's product image from our own domain instead of hot-linking Amazon, so a buyer reading the listing source cannot identify the supplier.

**Architecture:** On the create path, each product's first image is copied once from Amazon (already resized by Amazon's own filename modifier) into a Cloudflare R2 bucket keyed by the Keepa filename, and the description template renders that mirrored URL — or nothing at all. The read path is Cloudflare → R2 with no SellerHill component in it. The eBay gallery is deliberately untouched.

**Tech Stack:** TypeScript, NestJS, raw `pg`, Jest (CJS + ts-jest), `@aws-sdk/client-s3` (new dependency, S3-compatible R2 API), Cloudflare R2 + custom domain.

**Spec:** [docs/superpowers/specs/2026-09-24-listing-image-mirror-design.md](../specs/2026-09-24-listing-image-mirror-design.md)

## Global Constraints

- **The Amazon image host must never appear in a rendered description.** `main_image` is the mirrored URL or the empty string — never a fallback to Amazon. (Spec D2)
- **Source variant is `_SL800_`.** The Keepa name already carries its extension, so the source URL is built by splitting on the final dot: `71nx65qZq6L.jpg` → `71nx65qZq6L._SL800_.jpg`. The R2 key is the name verbatim. (Spec D3, D4)
- **The eBay gallery payload is never rewritten.** `ebay-listing-payload.ts` keeps Amazon URLs. (Spec, out-of-scope section)
- **Never DELETE a `predefined_templates` row** — soft-retire with `is_active = FALSE`. There is no FK protecting catalog rows.
- **An applied migration is never edited.** New behaviour ships as a new numbered file. Next free number: `116` (see Task 2).
- **All new configuration is env-only**, never in `platform-settings.registry.ts`. (Spec, Configuration section)
- **Nothing on the image path may block listing creation.** Every mirror failure is swallowed and logged.
- After changing `packages/shared`, run `pnpm --filter @repo/shared build` before API tests — `apps/api` resolves `@repo/shared` to `dist/cjs`.
- Verification commands: `pnpm --filter api test`, `pnpm lint`, `pnpm typecheck`.
- Commit messages follow conventional commits and end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Review Focus

These are the inputs the spec implies but does not describe, ordered by how badly each would bite a seller. Each has a test in the task that owns the code.

1. **A Keepa name with no dot** (`71nx65qZq6L`, no extension). Splitting on the final dot finds nothing; the source URL must not be built and the image must not be mirrored — rather than producing `._SL800_71nx65qZq6L` or a 404 that is cached for 20 years. Task 3.
2. **A name containing `/`, `..`, or a query string.** It reaches an R2 object key and an outbound URL, so it must be rejected by validation before either is constructed. Task 3.
3. **Amazon answers non-200, or answers 200 with `text/html`** (a dead image id returns an error page). Garbage must not be written to R2 and `image_mirrored_at` must not be set, or the listing renders a broken image forever. Task 5.
4. **R2 PUT throws** (credentials wrong, bucket missing, network). Listing creation must still succeed; the description renders with no image. Task 5.
5. **A product with an empty `image_urls` array.** No mirror is attempted, `main_image` is empty, nothing crashes. Task 6.

---

### Task 1: Remove `images` and `has_images` from the template vocabulary

Operator decision: a custom template must not render the full image set either, so `images` leaves the canonical list entirely rather than only the seller-offered one. `has_images` goes with it — it exists solely to wrap an `{{#images}}` list, and leaving it would let a custom template render an empty but styled wrapper.

Removing the entry narrows the `ListingTemplatePlaceholder` union, so any remaining reference fails to compile. That is the intended enforcement.

**Files:**
- Modify: `packages/shared/src/utils/listing-template.ts`
- Test: `apps/api/src/modules/listings/listing-template.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `LISTING_TEMPLATE_PLACEHOLDERS` without `'images'`; `LISTING_TEMPLATE_PRESENCE_FLAGS` = `['has_features', 'has_details']`; `buildListingTemplateContext` no longer emits `images` or `has_images`.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/modules/listings/listing-template.spec.ts`, add:

```typescript
describe('images vocabulary removal', () => {
  const context = buildListingTemplateContext({
    title: 'T',
    imageUrls: ['https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L.jpg'],
  });

  it('renders nothing for an images section, even with images present', () => {
    expect(renderListingTemplate('A{{#images}}<img src="{{.}}">{{/images}}B', context)).toBe('AB');
  });

  it('renders nothing for a has_images section', () => {
    expect(renderListingTemplate('A{{#has_images}}X{{/has_images}}B', context)).toBe('AB');
  });

  it('does not offer images as a placeholder', () => {
    expect(LISTING_TEMPLATE_PLACEHOLDERS).not.toContain('images');
    expect(LISTING_TEMPLATE_SAFE_PLACEHOLDERS).not.toContain('images');
  });

  it('does not list has_images as a presence flag', () => {
    expect(LISTING_TEMPLATE_PRESENCE_FLAGS).not.toContain('has_images');
  });
});
```

Remove the two existing `has_images` assertions at `listing-template.spec.ts:102` and `:105`.

Add `LISTING_TEMPLATE_PLACEHOLDERS`, `LISTING_TEMPLATE_SAFE_PLACEHOLDERS` and `LISTING_TEMPLATE_PRESENCE_FLAGS` to the file's existing `@repo/shared` import if absent.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- listing-template`
Expected: FAIL — the images section still renders the `<img>` tag; `LISTING_TEMPLATE_PLACEHOLDERS` still contains `'images'`.

- [ ] **Step 3: Remove the vocabulary**

In `packages/shared/src/utils/listing-template.ts`:

Delete `'images',` from `LISTING_TEMPLATE_PLACEHOLDERS`.

Change the presence flags:

```typescript
export const LISTING_TEMPLATE_PRESENCE_FLAGS = ['has_features', 'has_details'] as const;
```

In `buildListingTemplateContext`, delete the `images,` and `has_images: ...` properties from the returned object. Keep the local `images` const — `main_image` still reads `images[0]` until Task 7 replaces it.

Replace `buildListingTemplateSnippet` and its doc comment with:

```typescript
/**
 * The template text a one-click placeholder shortcut inserts.
 *
 * Every remaining placeholder inserts as a plain `{{key}}`. `images` used to be
 * an exception here — it needed a hand-written repeating section, because a
 * bare `{{images}}` joins the URLs with ", " and publishes a wall of raw text.
 * It is gone from the vocabulary entirely (2026-09-24): only one image per
 * listing is rendered, and it is served from our own domain.
 */
export function buildListingTemplateSnippet(placeholder: ListingTemplatePlaceholder): string {
  return `{{${placeholder}}}`;
}
```

In the file header comment, delete the `has_images` mention on lines 24-25.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- listing-template`
Expected: PASS. `{{#images}}` now has no matching context key, so `stripUnresolvedPlaceholders` removes the whole block.

- [ ] **Step 5: Typecheck to surface remaining references**

Run: `pnpm typecheck`
Expected: PASS. If a reference to `'images'` as a `ListingTemplatePlaceholder` remains anywhere (web placeholder chips, API), the narrowed union reports it — fix each by deleting the reference.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/listing-template.ts apps/api/src/modules/listings/listing-template.spec.ts
git commit -m "$(cat <<'EOF'
feat(shared): drop images and has_images from the template vocabulary

Only one image per listing is rendered now, and it is served from our own
domain. A custom template must not be able to render the full Amazon image
set either, so the placeholder leaves the canonical list rather than only the
seller-offered one; has_images goes with it, since it exists solely to wrap an
images list and would otherwise render an empty styled wrapper.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: DROPPED — `gallery-grid` no longer exists

**Do not implement this task.** It rested on a false premise, and the commit
that implemented it has been reverted (`d4c91b1` → `3882476`).

The plan claimed `gallery-grid` was still a selectable catalog row because
migration `073` "only inserts new rows". It does not. `073` line 4 is
`DELETE FROM predefined_templates;`, which wipes the whole catalog before
inserting its 12 replacements — so `gallery-grid` was destroyed there, and a
migration retiring it updates zero rows.

The task's goal turns out to need no migration at all: each of the 12 live
templates carries exactly one `{{#main_image}}` and none carries `{{#images}}`,
so Task 1's vocabulary removal is the entire guarantee.

Two things worth carrying forward, neither in this plan's scope:

- **`073` violated CLAUDE.md's own rule** — "Never DELETE a catalog row —
  there is no FK to protect it." Every `listing_settings_groups.templates ->>
  'predefinedTemplateId'` pointing at a `072`-era template was silently
  detached by that DELETE and now degrades to the default template while the
  UI keeps showing the chosen name. Pre-existing; this plan did not cause it.
- **Task 4 takes migration number `116`**, freed by the reversal.
---

### Task 3: Pure image-name helpers

The whole design rests on the Keepa filename being the image's entire identity. These three functions are where that is enforced: one validates the name, one builds the Amazon source URL, one builds our own. They are pure, so the two Review Focus items about malformed names are tested here with no I/O.

**Files:**
- Create: `packages/shared/src/utils/product-image.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/api/src/modules/listings/product-image.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `AMAZON_IMAGE_SIZE_VARIANT: '_SL800_'`
  - `isValidKeepaImageName(name: string): boolean`
  - `extractKeepaImageName(url: string): string | null`
  - `buildAmazonSourceImageUrl(name: string): string | null`
  - `buildMirroredImageUrl(name: string, baseUrl: string): string | null`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/listings/product-image.spec.ts`:

```typescript
import {
  buildAmazonSourceImageUrl,
  buildMirroredImageUrl,
  extractKeepaImageName,
  isValidKeepaImageName,
} from '@repo/shared';

const NAME = '71nx65qZq6L.jpg';
const SOURCE = `https://images-na.ssl-images-amazon.com/images/I/${NAME}`;

describe('isValidKeepaImageName', () => {
  it('accepts a real Keepa name', () => {
    expect(isValidKeepaImageName(NAME)).toBe(true);
    expect(isValidKeepaImageName('51a-b_c+d.png')).toBe(true);
  });

  it('rejects a name with no extension', () => {
    expect(isValidKeepaImageName('71nx65qZq6L')).toBe(false);
  });

  it('rejects an interior dot — the allowlist stays strict', () => {
    expect(isValidKeepaImageName('a.b.jpg')).toBe(false);
  });

  it('rejects path separators, traversal and query strings', () => {
    expect(isValidKeepaImageName('../secret.jpg')).toBe(false);
    expect(isValidKeepaImageName('a/b.jpg')).toBe(false);
    expect(isValidKeepaImageName('a\\b.jpg')).toBe(false);
    expect(isValidKeepaImageName('a.jpg?x=1')).toBe(false);
    expect(isValidKeepaImageName('a.jpg#f')).toBe(false);
  });

  it('rejects empty, overlong and non-string input', () => {
    expect(isValidKeepaImageName('')).toBe(false);
    expect(isValidKeepaImageName(`${'a'.repeat(70)}.jpg`)).toBe(false);
    expect(isValidKeepaImageName(undefined as unknown as string)).toBe(false);
  });
});

describe('extractKeepaImageName', () => {
  it('pulls the name out of an Amazon image URL', () => {
    expect(extractKeepaImageName(SOURCE)).toBe(NAME);
  });

  it('returns null for a URL whose last segment is not a valid name', () => {
    expect(extractKeepaImageName('https://images-na.ssl-images-amazon.com/images/I/71nx')).toBeNull();
    expect(extractKeepaImageName('')).toBeNull();
  });
});

describe('buildAmazonSourceImageUrl', () => {
  it('inserts the size variant before the final dot', () => {
    expect(buildAmazonSourceImageUrl(NAME)).toBe(
      'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L._SL800_.jpg'
    );
  });

  it('returns null for an invalid name rather than a broken URL', () => {
    expect(buildAmazonSourceImageUrl('71nx65qZq6L')).toBeNull();
    expect(buildAmazonSourceImageUrl('../x.jpg')).toBeNull();
    // An interior dot is rejected by isValidKeepaImageName, so there is no
    // "which dot do we split on" question to answer. Real Keepa names are
    // `<stem>.<ext>` with no interior dot; keeping the allowlist strict keeps
    // the SSRF and key-injection guard tight.
    expect(buildAmazonSourceImageUrl('a.b.jpg')).toBeNull();
  });
});

describe('buildMirroredImageUrl', () => {
  it('joins the base and the name verbatim', () => {
    expect(buildMirroredImageUrl(NAME, 'https://img.example.com')).toBe(
      `https://img.example.com/${NAME}`
    );
  });

  it('tolerates a trailing slash on the base', () => {
    expect(buildMirroredImageUrl(NAME, 'https://img.example.com/')).toBe(
      `https://img.example.com/${NAME}`
    );
  });

  it('returns null for an invalid name or a missing base', () => {
    expect(buildMirroredImageUrl('../x.jpg', 'https://img.example.com')).toBeNull();
    expect(buildMirroredImageUrl(NAME, '')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- product-image`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/utils/product-image.ts`:

```typescript
/**
 * Deriving the mirrored image URL from the Keepa filename.
 *
 * `keepa-normalizer` builds every Amazon image URL as
 * `https://images-na.ssl-images-amazon.com/images/I/${name}`, so the name IS
 * the image's whole identity. That is what lets the mirror work with no ID
 * table and no lookup, and it is why the same physical image shared by many
 * ASINs and many sellers is one stored object.
 *
 * The name already carries its extension (`71nx65qZq6L.jpg`), so the two
 * derivations differ: our key is the name verbatim, while Amazon's source URL
 * needs the size variant inserted before the final dot.
 */

const AMAZON_IMAGE_BASE = 'https://images-na.ssl-images-amazon.com/images/I';

/**
 * The size Amazon renders for us. Verified 2026-09-24: the same image is
 * 185,303 bytes unmodified and 45,132 bytes at `_SL800_`, so Amazon performs
 * the resize and the mirror is a byte copy with no transform component.
 */
export const AMAZON_IMAGE_SIZE_VARIANT = '_SL800_';

const MAX_IMAGE_NAME_LENGTH = 64;

/**
 * A name is usable only if it is a bare filename with an extension.
 *
 * This is the only guard between provider-supplied text and both an object key
 * and an outbound URL, so it is a strict allowlist rather than a denylist: no
 * slash, no backslash, no traversal, no query string, no fragment. A name
 * without a dot is rejected because the size variant has nowhere to go — it
 * would otherwise produce a URL Amazon answers with an error page that
 * Cloudflare would then cache.
 */
export function isValidKeepaImageName(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0 || name.length > MAX_IMAGE_NAME_LENGTH) {
    return false;
  }
  return /^[A-Za-z0-9+_-]+\.[A-Za-z0-9]{2,5}$/.test(name);
}

/** The final path segment of an Amazon image URL, when it is a usable name. */
export function extractKeepaImageName(url: string): string | null {
  if (typeof url !== 'string' || url.length === 0) {
    return null;
  }
  const name = url.split('/').pop() ?? '';
  return isValidKeepaImageName(name) ? name : null;
}

/** Amazon's own URL for the resized variant, or null when the name is unusable. */
export function buildAmazonSourceImageUrl(name: string): string | null {
  if (!isValidKeepaImageName(name)) {
    return null;
  }
  const dot = name.lastIndexOf('.');
  const stem = name.slice(0, dot);
  const extension = name.slice(dot);
  return `${AMAZON_IMAGE_BASE}/${stem}.${AMAZON_IMAGE_SIZE_VARIANT}${extension}`;
}

/** Our own URL for a mirrored image, or null when it cannot be built safely. */
export function buildMirroredImageUrl(name: string, baseUrl: string): string | null {
  if (!isValidKeepaImageName(name) || typeof baseUrl !== 'string' || baseUrl.length === 0) {
    return null;
  }
  return `${baseUrl.replace(/\/+$/, '')}/${name}`;
}
```

Note the source URL shape: `stem` + `.` + `_SL800_` + `.jpg`, matching the verified
`71nx65qZq6L._SL800_.jpg`.

Add to `packages/shared/src/index.ts`, beside the other `utils` re-exports:

```typescript
export * from './utils/product-image';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- product-image`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/utils/product-image.ts packages/shared/src/index.ts apps/api/src/modules/listings/product-image.spec.ts
git commit -m "$(cat <<'EOF'
feat(shared): derive mirrored image URLs from the Keepa filename

The Keepa name is the image's whole identity, so the mirror needs no ID table
and the same image shared across ASINs is one object. The name carries its own
extension, so the size variant is inserted before the final dot; a name without
one is refused rather than turned into a URL Amazon answers with an error page.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Persist the mirror watermark

`products.image_mirrored_at` records that this product's first image is in the bucket, so the render path needs no R2 round-trip and the GC has a cheap live set (`image_urls->>0` where the column is set).

**Files:**
- Create: `apps/api/migrations/116_products_image_mirrored_at.sql`
- Modify: `packages/shared/src/domain/products/product-data.types.ts`
- Modify: `apps/api/src/modules/listings/listings.service.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ProductData.mainImageMirroredUrl?: string` — the field Task 7 renders and Task 6 fills.

- [ ] **Step 1: Write the migration**

Create `apps/api/migrations/116_products_image_mirrored_at.sql`:

```sql
-- Watermark for the description-image mirror.
--
-- The description `<img>` is hot-linked by the buyer's browser, so an Amazon
-- URL there names the supplier in the page source for the life of the listing.
-- The first image of each product is therefore copied once into our own bucket
-- and the description renders that. (The eBay gallery is untouched: eBay
-- re-hosts those images itself, so there is nothing to conceal and proxying
-- them would put a failure point on the synchronous publish path.)
--
-- NULL means "not mirrored", which is also the retry signal: the create path
-- re-attempts whenever it sees NULL, so a transient failure is repaired by the
-- next listing for that ASIN rather than persisting. The description renders
-- with no image while it is NULL — deliberately, since it is never revised
-- after publish and a single Amazon fallback would expose the supplier there
-- permanently.
--
-- The object key is not stored: it is the last path segment of
-- `image_urls->>0`, which is what makes the mirror need no mapping table.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS image_mirrored_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_image_not_mirrored
    ON products (id)
 WHERE image_mirrored_at IS NULL;
```

- [ ] **Step 2: Add the carrier field**

In `packages/shared/src/domain/products/product-data.types.ts`, inside `interface ProductData`, after `imageUrls`:

```typescript
  /**
   * Our own URL for this product's first image, when it has been mirrored.
   *
   * Resolved on the create path and read by the description template. Undefined
   * means not mirrored, and the template then renders no image at all — it must
   * never fall back to the `imageUrls` entry, which names the supplier.
   */
  mainImageMirroredUrl?: string;
```

- [ ] **Step 3: Select and map the column**

In `apps/api/src/modules/listings/listings.service.ts`:

Add `image_mirrored_at: Date | string | null;` to the product row interface at line 63 and to the one at line 103.

Add `p.image_mirrored_at` (or `image_mirrored_at` where the query has no alias) to the product `SELECT` lists at lines 551, 820 and 1042.

`mainImageMirroredUrl` is filled by Task 6, not by the mapper — the mapper only needs the raw column available on the row.

- [ ] **Step 4: Verify the migration and typecheck**

Replay every migration in order against a clean stock Postgres (CLAUDE.md's recipe): `docker run -d --name mirror-migrate-test -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb -p 55432:5432 postgres:18-alpine`, then `CREATE ROLE sellerhill_user LOGIN;`, then pipe every file in `apps/api/migrations/` through `psql -v ON_ERROR_STOP=1` in order. Then:

```bash
docker exec -i mirror-migrate-test psql -U postgres -d testdb -c "\d products" | grep image_mirrored_at
docker rm -f mirror-migrate-test
```

Expected: the column is listed. Then run `pnpm --filter @repo/shared build && pnpm typecheck` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/migrations/116_products_image_mirrored_at.sql packages/shared/src/domain/products/product-data.types.ts apps/api/src/modules/listings/listings.service.ts
git commit -m "$(cat <<'EOF'
feat(listings): record whether a product image has been mirrored

NULL is both the initial state and the retry signal, so a transient mirror
failure is repaired by the next listing for that ASIN. The object key is not
stored: it is the last segment of image_urls->>0, which is what lets the mirror
work without a mapping table.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `ImageMirrorService`

Copies one image from Amazon into R2, idempotently and fail-soft. Review Focus items 3 and 4 are tested here: a non-image response must not be stored, and a PUT failure must not propagate.

**Files:**
- Create: `apps/api/src/modules/image-mirror/image-mirror.service.ts`
- Create: `apps/api/src/modules/image-mirror/image-mirror.module.ts`
- Test: `apps/api/src/modules/image-mirror/image-mirror.service.spec.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Consumes: `buildAmazonSourceImageUrl`, `buildMirroredImageUrl`, `extractKeepaImageName` (Task 3); `products.image_mirrored_at` (Task 4).
- Produces:
  - `ImageMirrorService.isConfigured(): boolean`
  - `ImageMirrorService.ensureMirrored(productId: string, imageUrl: string | undefined, alreadyMirrored: boolean): Promise<string | null>` — returns our URL, or `null`. Never throws.

- [ ] **Step 1: Add the dependency and the environment keys**

```bash
pnpm --filter api add @aws-sdk/client-s3
```

Append to `apps/api/.env.example`:

```
# Description-image mirror (Cloudflare R2). All optional: with any of these
# unset the mirror is disabled, descriptions render with no image, and nothing
# else changes. Env-only by design — an editable destination would let a
# compromised admin session repoint every listing image at a host it controls.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
IMAGE_CDN_BASE_URL=
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/modules/image-mirror/image-mirror.service.spec.ts`:

```typescript
import { ImageMirrorService } from './image-mirror.service';

const NAME = '71nx65qZq6L.jpg';
const SOURCE = `https://images-na.ssl-images-amazon.com/images/I/${NAME}`;

function makeService(overrides: { put?: jest.Mock; fetch?: jest.Mock } = {}) {
  const config = {
    get: (key: string) =>
      ({
        R2_ACCOUNT_ID: 'acc',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET: 'bucket',
        IMAGE_CDN_BASE_URL: 'https://img.example.com',
      })[key],
  };
  const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  const service = new ImageMirrorService(config as never, database as never);
  const put = overrides.put ?? jest.fn().mockResolvedValue(undefined);
  (service as unknown as { putObject: unknown }).putObject = put;
  global.fetch = (overrides.fetch ??
    jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/jpeg', 'cache-control': 'max-age=630720000' }),
      arrayBuffer: async () => new ArrayBuffer(1024),
    })) as never;
  return { service, put, database };
}

describe('ImageMirrorService.ensureMirrored', () => {
  it('mirrors and returns our own URL', async () => {
    const { service, put, database } = makeService();
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(database.query).toHaveBeenCalled();
  });

  it('skips the copy when already mirrored but still returns the URL', async () => {
    const { service, put } = makeService();
    await expect(service.ensureMirrored('p1', SOURCE, true)).resolves.toBe(
      `https://img.example.com/${NAME}`
    );
    expect(put).not.toHaveBeenCalled();
  });

  it('does not store a non-image response and does not mark it mirrored', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: async () => new ArrayBuffer(512),
    });
    const { service, put, database } = makeService({ fetch });
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('returns null on a non-200 from Amazon', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, headers: new Headers() });
    const { service, put } = makeService({ fetch });
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
  });

  it('swallows a storage failure so listing creation is never blocked', async () => {
    const put = jest.fn().mockRejectedValue(new Error('r2 down'));
    const { service, database } = makeService({ put });
    await expect(service.ensureMirrored('p1', SOURCE, false)).resolves.toBeNull();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('returns null for a missing or unusable image URL', async () => {
    const { service, put } = makeService();
    await expect(service.ensureMirrored('p1', undefined, false)).resolves.toBeNull();
    await expect(service.ensureMirrored('p1', 'https://x/images/I/nodot', false)).resolves.toBeNull();
    expect(put).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter api test -- image-mirror`
Expected: FAIL — the service does not exist.

- [ ] **Step 4: Write the service**

Create `apps/api/src/modules/image-mirror/image-mirror.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { buildAmazonSourceImageUrl, buildMirroredImageUrl, extractKeepaImageName } from '@repo/shared';
import { DatabaseService } from '../../common/database/database.service';

/** Amazon's own header on these objects; copied so our copy ages the same way. */
const DEFAULT_CACHE_CONTROL = 'public, max-age=630720000, immutable';
const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Copies a product's first image into our own bucket so the eBay description
 * can render it without naming the supplier.
 *
 * Everything here is best-effort. A failure returns null, the product stays
 * unmirrored, and the description renders with no image — a listing must never
 * fail because of a picture. NULL is also the retry signal, so the next listing
 * for the same ASIN tries again.
 */
@Injectable()
export class ImageMirrorService {
  private readonly logger = new Logger(ImageMirrorService.name);
  private client: S3Client | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('R2_ACCOUNT_ID') &&
        this.config.get<string>('R2_ACCESS_KEY_ID') &&
        this.config.get<string>('R2_SECRET_ACCESS_KEY') &&
        this.config.get<string>('R2_BUCKET') &&
        this.config.get<string>('IMAGE_CDN_BASE_URL')
    );
  }

  async ensureMirrored(
    productId: string,
    imageUrl: string | undefined,
    alreadyMirrored: boolean
  ): Promise<string | null> {
    if (!this.isConfigured() || !imageUrl) {
      return null;
    }
    const name = extractKeepaImageName(imageUrl);
    if (!name) {
      this.logger.warn(`Unusable image name for product ${productId}; not mirroring`);
      return null;
    }
    const publicUrl = buildMirroredImageUrl(name, this.config.get<string>('IMAGE_CDN_BASE_URL') as string);
    if (!publicUrl) {
      return null;
    }
    if (alreadyMirrored) {
      return publicUrl;
    }

    try {
      const body = await this.download(name);
      if (!body) {
        return null;
      }
      await this.putObject(name, body.bytes, body.contentType, body.cacheControl);
      await this.database.query(`UPDATE products SET image_mirrored_at = NOW() WHERE id = $1`, [productId]);
      return publicUrl;
    } catch (error) {
      this.logger.warn(
        `Mirror failed for product ${productId} (${name}): ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * A 200 carrying `text/html` is Amazon's error page for a dead image id.
   * Storing it would publish a broken image under a 20-year cache header, so
   * the content type is checked before anything is written.
   */
  private async download(
    name: string
  ): Promise<{ bytes: Uint8Array; contentType: string; cacheControl: string } | null> {
    const sourceUrl = buildAmazonSourceImageUrl(name);
    if (!sourceUrl) {
      return null;
    }
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) {
      this.logger.warn(`Amazon answered ${response.status} for ${name}; not mirroring`);
      return null;
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      this.logger.warn(`Amazon answered ${contentType || 'no content-type'} for ${name}; not mirroring`);
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      this.logger.warn(`Refusing ${bytes.byteLength} bytes for ${name}`);
      return null;
    }
    return {
      bytes,
      contentType,
      cacheControl: response.headers.get('cache-control') ?? DEFAULT_CACHE_CONTROL,
    };
  }

  private getClient(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') as string,
          secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') as string,
        },
      });
    }
    return this.client;
  }

  private async putObject(
    key: string,
    bytes: Uint8Array,
    contentType: string,
    cacheControl: string
  ): Promise<void> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.config.get<string>('R2_BUCKET') as string,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: cacheControl,
      })
    );
  }
}
```

Create `apps/api/src/modules/image-mirror/image-mirror.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ImageMirrorService } from './image-mirror.service';

@Module({
  providers: [ImageMirrorService],
  exports: [ImageMirrorService],
})
export class ImageMirrorModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter api test -- image-mirror`
Expected: PASS, all six cases.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/image-mirror apps/api/package.json apps/api/.env.example pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(image-mirror): copy a product image into our own bucket

Best-effort throughout: a failure returns null, the product stays unmirrored
and the description renders with no image, because a listing must never fail
over a picture. A 200 carrying text/html is Amazon's error page for a dead
image id and is refused before anything is written, since storing it would
publish a broken image under a 20-year cache header.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Mirror on the create path

The mirror is awaited rather than queued. The description is written once at publish and never revised, so a mirror that finished afterwards would leave that listing permanently without an image.

**Files:**
- Modify: `apps/api/src/modules/listings/listing-processor.service.ts`
- Modify: `apps/api/src/modules/listings/listings.module.ts`
- Modify: `apps/api/src/modules/listings/listings.service.ts` — `getProductByAsin` returns `image_mirrored_at` alongside `id` and `data` (Task 4 added the column to the row interfaces and SELECT lists; this widens the method's own return shape)
- Test: `apps/api/src/modules/listings/listing-processor-image.spec.ts`

**Interfaces:**
- Consumes: `ImageMirrorService.ensureMirrored` (Task 5); `ProductData.mainImageMirroredUrl` (Task 4).
- Produces: `resolveProductData` returns `productData` whose `mainImageMirroredUrl` is set when the image is mirrored, on both the cache-hit and the create branch.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/listings/listing-processor-image.spec.ts`:

```typescript
import { attachMirroredImage } from './listing-processor.service';

describe('attachMirroredImage', () => {
  const mirror = (url: string | null) => ({ ensureMirrored: jest.fn().mockResolvedValue(url) });

  it('attaches our URL when the mirror succeeds', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as never;
    const service = mirror('https://img.example.com/71nx65qZq6L.jpg');
    await attachMirroredImage(service as never, 'p1', product, false);
    expect((product as { mainImageMirroredUrl?: string }).mainImageMirroredUrl).toBe(
      'https://img.example.com/71nx65qZq6L.jpg'
    );
  });

  it('leaves the field undefined when the mirror fails', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as never;
    await attachMirroredImage(mirror(null) as never, 'p1', product, false);
    expect((product as { mainImageMirroredUrl?: string }).mainImageMirroredUrl).toBeUndefined();
  });

  it('attempts nothing for a product with no images', async () => {
    const product = { imageUrls: [] } as never;
    const service = mirror(null);
    await attachMirroredImage(service as never, 'p1', product, false);
    expect(service.ensureMirrored).not.toHaveBeenCalled();
  });

  it('never throws, whatever the mirror does', async () => {
    const product = { imageUrls: ['https://a/images/I/71nx65qZq6L.jpg'] } as never;
    const service = { ensureMirrored: jest.fn().mockRejectedValue(new Error('boom')) };
    await expect(attachMirroredImage(service as never, 'p1', product, false)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test -- listing-processor-image`
Expected: FAIL — `attachMirroredImage` is not exported.

- [ ] **Step 3: Implement and wire it**

In `apps/api/src/modules/listings/listing-processor.service.ts`, add the exported helper at module scope:

```typescript
/**
 * Fill `mainImageMirroredUrl` in place, best-effort.
 *
 * Exported so it can be tested without standing up the processor. It never
 * throws: an image is not worth failing a listing over, and an unmirrored
 * product simply renders no image and is retried on the next listing for the
 * same ASIN.
 */
export async function attachMirroredImage(
  mirror: { ensureMirrored: (productId: string, imageUrl: string | undefined, already: boolean) => Promise<string | null> },
  productId: string,
  product: ProductData,
  alreadyMirrored: boolean
): Promise<void> {
  const first = product.imageUrls?.[0];
  if (!first) {
    return;
  }
  try {
    const mirrored = await mirror.ensureMirrored(productId, first, alreadyMirrored);
    if (mirrored) {
      product.mainImageMirroredUrl = mirrored;
    }
  } catch {
    // Deliberately silent — ImageMirrorService already logs, and this must not
    // be able to interrupt listing creation.
  }
}
```

Inject the service in the constructor:

```typescript
    private readonly imageMirror: ImageMirrorService,
```

with `import { ImageMirrorService } from '../image-mirror/image-mirror.service';`.

In `resolveProductData`, call it on both return paths. Cache hit (after `asUsableCache`):

```typescript
    const cached = this.asUsableCache(await this.listingsService.getProductByAsin(asin, marketplace));
    if (cached) {
      this.logger.log(`Using cached product data for ASIN ${asin} (no Keepa call)`);
      await attachMirroredImage(this.imageMirror, cached.productId, cached.productData, cached.alreadyMirrored);
      return cached;
    }
```

Apply the same two lines to `cachedAfterLock`, and after `findOrCreateProduct`:

```typescript
      const productId = await this.listingsService.findOrCreateProduct(asin, keepaProduct, marketplace);
      await attachMirroredImage(this.imageMirror, productId, keepaProduct, false);
      return { productData: keepaProduct, productId };
```

Extend `asUsableCache` to carry the flag through, reading the column Task 4 added to the row:

```typescript
  private asUsableCache(
    existing: { id: string; data: ProductData; image_mirrored_at?: Date | string | null } | null
  ): { productData: ProductData; productId: string; alreadyMirrored: boolean } | null {
```

and include `alreadyMirrored: Boolean(existing.image_mirrored_at)` in its return object. Update `getProductByAsin` to return `image_mirrored_at` alongside `id` and `data`.

Add `ImageMirrorModule` to the `imports` array of `apps/api/src/modules/listings/listings.module.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- listing-processor-image`
Expected: PASS, all four cases.

- [ ] **Step 5: Run the full suite and typecheck**

Run: `pnpm --filter api test && pnpm typecheck`
Expected: PASS. `resolveProductData`'s return type widened, so any caller destructuring it still compiles.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/listings/listing-processor.service.ts apps/api/src/modules/listings/listings.module.ts apps/api/src/modules/listings/listing-processor-image.spec.ts
git commit -m "$(cat <<'EOF'
feat(listings): mirror the product image on the create path

Awaited rather than queued: the description is written once at publish and
never revised, so a mirror that finished afterwards would leave that listing
permanently without an image. A cached product whose watermark is NULL is
retried here, so a transient failure is repaired by the next listing for the
same ASIN.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Render the mirrored URL, or nothing

The decision this task implements: `main_image` is our URL or the empty string, never the Amazon one.

**Files:**
- Modify: `packages/shared/src/utils/listing-template.ts`
- Modify: `apps/api/src/modules/listings/listing-strategy.service.ts:343-357`
- Test: `apps/api/src/modules/listings/listing-template.spec.ts`

**Interfaces:**
- Consumes: `ProductData.mainImageMirroredUrl` (Task 4).
- Produces: `ListingTemplateInput.mainImageUrl?: string`; `buildListingTemplateContext` sets `main_image` from it alone.

- [ ] **Step 1: Write the failing tests**

Add to `apps/api/src/modules/listings/listing-template.spec.ts`:

```typescript
describe('main_image never carries the source URL', () => {
  const AMAZON = 'https://images-na.ssl-images-amazon.com/images/I/71nx65qZq6L.jpg';

  it('renders the mirrored URL when one is supplied', () => {
    const context = buildListingTemplateContext({
      title: 'T',
      imageUrls: [AMAZON],
      mainImageUrl: 'https://img.example.com/71nx65qZq6L.jpg',
    });
    expect(context.main_image).toBe('https://img.example.com/71nx65qZq6L.jpg');
  });

  it('renders nothing when no mirrored URL is supplied, even with imageUrls present', () => {
    const context = buildListingTemplateContext({ title: 'T', imageUrls: [AMAZON] });
    expect(context.main_image).toBe('');
    expect(renderListingTemplate('A{{#main_image}}<img src="{{.}}">{{/main_image}}B', context)).toBe('AB');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- listing-template`
Expected: FAIL — `main_image` still resolves to the Amazon URL from `imageUrls[0]`.

- [ ] **Step 3: Change the context builder**

In `packages/shared/src/utils/listing-template.ts`, add to `ListingTemplateInput` after `imageUrls`:

```typescript
  /**
   * The already-resolved URL for the single rendered image.
   *
   * `main_image` reads this and nothing else. It deliberately does NOT fall
   * back to `imageUrls`: the description is written once at publish and never
   * revised, so one fallback would name the supplier on that listing for ever.
   * Rendering no image is the correct outcome — the eBay gallery still shows
   * every photo. The caller decides what to pass: the publish path passes the
   * mirrored URL or nothing, while the seller-facing template preview may pass
   * the source URL, since a preview is never published.
   */
  mainImageUrl?: string;
```

In `buildListingTemplateContext`, replace the `main_image` line with:

```typescript
    main_image: input.mainImageUrl ?? '',
```

The local `images` const is now unused — delete it and drop `imageUrls` from the destructuring if the linter flags it. Keep `imageUrls` on the interface: the gallery path still reads it.

In `apps/api/src/modules/listings/listing-strategy.service.ts`, inside `processDescriptionTemplate`'s `buildListingTemplateContext` call, replace `imageUrls: product.imageUrls,` with:

```typescript
      mainImageUrl: product.mainImageMirroredUrl,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- listing-template`
Expected: PASS.

- [ ] **Step 5: Update the template preview call site**

Run `pnpm typecheck`. The web template-preview call site still passes `imageUrls`; add `mainImageUrl: <the source URL it already has>` there so the seller keeps seeing a picture in the preview. Expected: PASS after the edit.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/listing-template.ts apps/api/src/modules/listings/listing-strategy.service.ts apps/api/src/modules/listings/listing-template.spec.ts apps/web/src
git commit -m "$(cat <<'EOF'
feat(listings): render the mirrored image URL, or none at all

main_image now reads a caller-supplied URL and never falls back to imageUrls.
The description is written once at publish and never revised, so one fallback
would name the supplier on that listing for ever; rendering no image is the
correct outcome, since the eBay gallery still shows every photo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Orphan collection

A product deleted by the reference-count path at `listings.service.ts:2189` leaves its object behind. This reconcile collects them — and refuses to run when it cannot see the live set, because treating a database outage as "no products exist" would empty the bucket.

**Files:**
- Create: `apps/api/src/modules/image-mirror/image-mirror-gc.ts`
- Create: `apps/api/src/modules/image-mirror/image-mirror-gc.service.ts`
- Test: `apps/api/src/modules/image-mirror/image-mirror-gc.spec.ts`
- Modify: `apps/api/src/modules/image-mirror/image-mirror.module.ts`

**Interfaces:**
- Consumes: `extractKeepaImageName` (Task 3); `products.image_mirrored_at` (Task 4).
- Produces: `selectOrphanKeys(storedKeys: string[], liveNames: Set<string>): string[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/image-mirror/image-mirror-gc.spec.ts`:

```typescript
import { selectOrphanKeys } from './image-mirror-gc';

describe('selectOrphanKeys', () => {
  it('returns only keys no live product references', () => {
    const live = new Set(['a.jpg', 'b.jpg']);
    expect(selectOrphanKeys(['a.jpg', 'b.jpg', 'c.jpg'], live)).toEqual(['c.jpg']);
  });

  it('returns nothing when every key is live', () => {
    expect(selectOrphanKeys(['a.jpg'], new Set(['a.jpg']))).toEqual([]);
  });

  it('returns nothing when the live set is empty', () => {
    expect(selectOrphanKeys(['a.jpg', 'b.jpg'], new Set())).toEqual([]);
  });
});
```

The third case is the important one: an empty live set means the caller learned nothing, so nothing is deleted. The service enforces the same rule again by aborting before it ever calls this.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test -- image-mirror-gc`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the pure helper**

Create `apps/api/src/modules/image-mirror/image-mirror-gc.ts`:

```typescript
/**
 * Keys in the bucket that no live product references.
 *
 * An empty live set yields no orphans. That is not a convenience: the only way
 * the live set is empty in practice is that the caller failed to read it, and
 * acting on that would delete every mirrored image on the platform.
 */
export function selectOrphanKeys(storedKeys: string[], liveNames: Set<string>): string[] {
  if (liveNames.size === 0) {
    return [];
  }
  return storedKeys.filter((key) => !liveNames.has(key));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter api test -- image-mirror-gc`
Expected: PASS, all three cases.

- [ ] **Step 5: Write the sweep service**

Create `apps/api/src/modules/image-mirror/image-mirror-gc.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
// SCHEDULING CORRECTED 2026-09-24: this codebase has no @nestjs/schedule.
// Every scheduled job is a BullMQ repeatable job. Follow
// billing/listing-plan-limit.processor.ts as the template.
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { extractKeepaImageName } from '@repo/shared';
import { DatabaseService } from '../../common/database/database.service';
import { ImageMirrorService } from './image-mirror.service';
import { selectOrphanKeys } from './image-mirror-gc';

const DELETE_BATCH = 1000;

/**
 * Collects mirrored images no live product references.
 *
 * Products are reference-counted: the last listing referencing one takes the
 * row with it (`listings.service.ts:2189`). That path fires only on explicit
 * listing deletion, not on INACTIVE, plan-limit retirement or account cascade,
 * so this sweep is what eventually collects the rest.
 */
@Injectable()
export class ImageMirrorGcService {
  private readonly logger = new Logger(ImageMirrorGcService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService,
    private readonly mirror: ImageMirrorService
  ) {}

  // Registered as a BullMQ repeatable tick, not a @Cron decorator.
  async sweep(): Promise<void> {
    if (!this.mirror.isConfigured()) {
      return;
    }

    let liveNames: Set<string>;
    try {
      liveNames = await this.loadLiveNames();
    } catch (error) {
      // Aborting is the whole point. A failed read is not evidence that no
      // products exist, and acting on it would empty the bucket.
      this.logger.error(
        `Aborting image GC: could not read the live product set (${error instanceof Error ? error.message : String(error)})`
      );
      return;
    }

    if (liveNames.size === 0) {
      this.logger.warn('Aborting image GC: the live product set is empty');
      return;
    }

    try {
      const removed = await this.deleteOrphans(liveNames);
      this.logger.log(`Image GC complete: ${removed} orphaned object(s) removed, ${liveNames.size} live`);
    } catch (error) {
      this.logger.error(`Image GC failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async loadLiveNames(): Promise<Set<string>> {
    const result = await this.database.query<{ url: string | null }>(
      `SELECT image_urls->>0 AS url FROM products WHERE image_mirrored_at IS NOT NULL`
    );
    const names = new Set<string>();
    for (const row of result.rows) {
      const name = row.url ? extractKeepaImageName(row.url) : null;
      if (name) {
        names.add(name);
      }
    }
    return names;
  }

  private client(): S3Client {
    return new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.get<string>('R2_ACCESS_KEY_ID') as string,
        secretAccessKey: this.config.get<string>('R2_SECRET_ACCESS_KEY') as string,
      },
    });
  }

  private async deleteOrphans(liveNames: Set<string>): Promise<number> {
    const bucket = this.config.get<string>('R2_BUCKET') as string;
    const client = this.client();
    let token: string | undefined;
    let removed = 0;

    do {
      const page = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token, MaxKeys: DELETE_BATCH })
      );
      const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
      const orphans = selectOrphanKeys(keys, liveNames);
      if (orphans.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: orphans.map((Key) => ({ Key })) },
          })
        );
        removed += orphans.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);

    return removed;
  }
}
```

Register it in `image-mirror.module.ts`: add `ImageMirrorGcService` to `providers`.

- [ ] **Step 6: Run the suite and typecheck**

Run: `pnpm --filter api test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/image-mirror
git commit -m "$(cat <<'EOF'
feat(image-mirror): collect images no live product references

The sweep aborts when it cannot read the live product set, and again when that
set comes back empty. A failed read is not evidence that no products exist, and
acting on it would empty the bucket — the same rule BrowserProfileGcService
follows for the same reason.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Guard specs

Each invariant here is one edit away from silently reverting, and none of them fail loudly when they do: a fallback to the Amazon URL still renders a picture, and rewriting the gallery still publishes. Source-greps in the style of `tracking-webhook-coverage.guard.spec.ts` are what keep them.

**Files:**
- Create: `apps/api/src/modules/listings/image-mirror-invariants.guard.spec.ts`

**Interfaces:**
- Consumes: the source files from Tasks 1, 5 and 7.
- Produces: nothing.

- [ ] **Step 1: Write the guard spec**

Create `apps/api/src/modules/listings/image-mirror-invariants.guard.spec.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '../../../../..');
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8');

describe('image mirror invariants', () => {
  it('main_image is fed only by the caller-supplied URL, never by imageUrls', () => {
    const source = read('packages/shared/src/utils/listing-template.ts');
    expect(source).toContain("main_image: input.mainImageUrl ?? ''");
    expect(source).not.toMatch(/main_image:\s*images\[0\]/);
  });

  it('the publish path passes the mirrored URL, not the source one', () => {
    const source = read('apps/api/src/modules/listings/listing-strategy.service.ts');
    expect(source).toContain('mainImageUrl: product.mainImageMirroredUrl');
    expect(source).not.toMatch(/imageUrls:\s*product\.imageUrls/);
  });

  it('the eBay gallery payload still carries the source URLs', () => {
    const source = read('apps/api/src/modules/ebay/ebay-listing-payload.ts');
    expect(source).toContain('data.imageUrls');
    expect(source).not.toContain('mainImageMirroredUrl');
    expect(source).not.toContain('IMAGE_CDN_BASE_URL');
  });

  it('images and has_images are gone from the template vocabulary', () => {
    const source = read('packages/shared/src/utils/listing-template.ts');
    expect(source).not.toMatch(/^\s*'images',$/m);
    expect(source).not.toContain('has_images');
  });

  it('the image CDN destination is env-only, never a platform setting', () => {
    const registry = read('apps/api/src/common/settings/platform-settings.registry.ts');
    expect(registry).not.toContain('IMAGE_CDN_BASE_URL');
    expect(registry).not.toContain('R2_');
  });
});
```

Each expectation carries its reason in the spec's Decisions section: D2 for the first two, the out-of-scope section for the third, D1 for the fourth, Configuration for the fifth.

- [ ] **Step 2: Run the guard spec**

Run: `pnpm --filter api test -- image-mirror-invariants`
Expected: PASS, all five.

- [ ] **Step 3: Run everything**

Run: `pnpm --filter api test && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/listings/image-mirror-invariants.guard.spec.ts
git commit -m "$(cat <<'EOF'
test(listings): lock the image mirror invariants

None of these fail loudly when they revert — a fallback to the Amazon URL
still renders a picture and a rewritten gallery still publishes — so they are
source-greps rather than behavioural tests.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Backfill existing products

Every product that predates the mirror has `image_mirrored_at IS NULL`, so the create path would only mirror it on the next listing for that ASIN. This script mirrors them in one pass.

**Files:**
- Create: `apps/api/src/scripts/mirror-product-images.ts`
- Modify: `apps/api/package.json` (script entry)

**Interfaces:**
- Consumes: `ImageMirrorService.ensureMirrored` (Task 5).
- Produces: `pnpm --filter api mirror:images [-- --limit N] [--dry-run]`.

- [ ] **Step 1: Write the script**

Create `apps/api/src/scripts/mirror-product-images.ts`, following the `user-set-role.ts` convention: load `apps/api/.env`, build a direct `pg` Pool, no NestJS bootstrap.

```typescript
// apps/api/src/scripts/mirror-product-images.ts
//
// Mirror the description image of products that predate the image mirror.
//
//   pnpm --filter api run mirror:images -- --limit 100000
//   pnpm --filter api run mirror:images -- --dry-run
//
// Resumable by construction: it claims only rows whose watermark is NULL, and
// `ImageMirrorService` stamps each row as it succeeds, so an interrupted run
// resumes where it stopped and a re-run costs nothing for rows already done.
//
// Sequential, with a small delay between rows, on purpose. This is the one
// place that fetches from Amazon in bulk from a single datacenter IP, and that
// IP is shared with the Playwright checkout pool — being throttled here would
// degrade order fulfillment, which matters far more than finishing sooner.
//
// Exit codes:
//   0 — completed (including a dry run)
//   2 — bad arguments
//   1 — configuration missing, or a fatal failure

import 'reflect-metadata';

import * as path from 'path';

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

import { ImageMirrorService } from '../modules/image-mirror/image-mirror.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEFAULT_LIMIT = 5000;
const DELAY_MS = 120;

const USAGE = [
  'Usage: pnpm --filter api run mirror:images -- [--limit N] [--dry-run]',
  '',
  '  --limit N   Maximum products to process (default 5000)',
  '  --dry-run   Report how many would be mirrored, write nothing',
].join('\n');

interface Args {
  limit: number;
  dryRun: boolean;
}

class ArgError extends Error {}

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: DEFAULT_LIMIT, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--limit') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value <= 0) {
        throw new ArgError(`--limit needs a positive integer, got "${argv[i + 1] ?? ''}"`);
      }
      args.limit = value;
      i += 1;
      continue;
    }
    throw new ArgError(`unknown argument "${token}"`);
  }
  return args;
}

const log = (message: string): void => void process.stdout.write(`${message}\n`);
const logError = (message: string): void => void process.stderr.write(`${message}\n`);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface PendingRow {
  id: string;
  url: string;
}

async function run(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error: unknown) {
    logError(error instanceof ArgError ? error.message : String(error));
    logError(USAGE);
    return 2;
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // The service reaches ConfigService and DatabaseService through one method
  // each, so plain objects are enough. That keeps the script from booting the
  // Nest container — and with it every scheduler and queue worker, which a
  // backfill has no business starting.
  const config = { get: (key: string) => process.env[key] };
  const database = { query: (text: string, params?: unknown[]) => pool.query(text, params) };
  const mirror = new ImageMirrorService(config as never, database as never);

  if (!mirror.isConfigured()) {
    logError('R2_* / IMAGE_CDN_BASE_URL are not all set — nothing to do.');
    await pool.end();
    return 1;
  }

  try {
    const { rows } = await pool.query<PendingRow>(
      `SELECT id, image_urls->>0 AS url
         FROM products
        WHERE image_mirrored_at IS NULL
          AND image_urls->>0 IS NOT NULL
        ORDER BY id ASC
        LIMIT $1`,
      [args.limit],
    );

    log(`${rows.length} product(s) pending.`);
    if (args.dryRun) {
      log('Dry run — nothing written.');
      return 0;
    }

    let mirrored = 0;
    let skipped = 0;
    for (const [index, row] of rows.entries()) {
      // ensureMirrored never throws: a failure returns null, leaves the
      // watermark NULL, and is retried on that ASIN's next listing.
      const url = await mirror.ensureMirrored(row.id, row.url, false);
      if (url) {
        mirrored += 1;
      } else {
        skipped += 1;
      }
      if ((index + 1) % 100 === 0) {
        log(`  ${index + 1}/${rows.length} (${mirrored} mirrored, ${skipped} skipped)`);
      }
      await sleep(DELAY_MS);
    }

    log(`Done: ${mirrored} mirrored, ${skipped} skipped, ${rows.length} examined.`);
    if (skipped > 0) {
      log('Skipped rows keep a NULL watermark and are retried on their next listing.');
    }
    return 0;
  } catch (error: unknown) {
    logError(`backfill failed: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await pool.end();
  }
}

void run().then((code) => {
  process.exit(code);
});
```

Add to `apps/api/package.json` scripts, after `aquiline:probe`:

```json
"mirror:images": "tsx src/scripts/mirror-product-images.ts"
```

- [ ] **Step 2: Verify against the real bucket with a small limit**

Run: `pnpm --filter api mirror:images -- --limit 5`
Expected: 5 objects appear in the bucket, and those 5 rows now carry `image_mirrored_at`. Fetch one through the CDN domain and confirm a 200 with `content-type: image/jpeg`.

- [ ] **Step 3: Run the backfill**

Run: `pnpm --filter api mirror:images -- --limit 100000`
Expected: a summary with no failures beyond dead ASINs.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/scripts/mirror-product-images.ts apps/api/package.json
git commit -m "$(cat <<'EOF'
feat(scripts): backfill mirrored images for existing products

Resumable by construction: it claims only rows with a NULL watermark and stamps
each row as it goes, so an interrupted run picks up where it stopped.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Deployment

These are operator steps, not code, and they must land in this order — the
backfill in Task 10 writes to the bucket, so the bucket must exist first.

1. Create the R2 bucket.
2. Connect the image subdomain to it as a **Custom Domain** (R2 → bucket →
   Settings → Custom Domains). Not a CNAME to the `r2.dev` URL, which
   Cloudflare documents as an unsupported access path. Leave the `r2.dev`
   development URL disabled.
3. Confirm `.jpg` is covered by Cloudflare's default cached file extensions;
   if not, add a Cache Rule.
4. Enable the tiered cache topology Cloudflare's R2 documentation recommends,
   so misses converge on one upper tier near the bucket.
5. Create an R2 API token scoped to **this bucket only**, with object read and
   write. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET` and `IMAGE_CDN_BASE_URL` in Coolify, and add the same five to
   both Coolify compose files' `api` service.
6. Deploy, then run Task 10's backfill.
7. Confirm current R2 pricing against the modelled ~45 GB.
