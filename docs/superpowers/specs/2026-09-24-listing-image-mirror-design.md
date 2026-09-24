# Listing image mirror — serving the description image from our own domain

Date: 2026-09-24
Status: approved design, not yet implemented

## Problem

A published eBay listing carries the product image on two independent surfaces,
and only one of them leaks the supplier.

| Surface | Built by | What eBay does | Amazon domain visible to a buyer? |
|---|---|---|---|
| Gallery (`product.imageUrls`) | `ebay-listing-payload.ts:108` | Downloads at publish and **re-hosts on `i.ebayimg.com`** | No |
| Description HTML (`{{main_image}}`) | `listing-template.ts:141` | Nothing — the `<img src>` stays as written | **Yes, permanently** |

The description image is hot-linked, so `images-na.ssl-images-amazon.com` sits
in the page source of every listing for as long as it is live. A buyer or a
competitor reading the source learns the supplier. That is the whole problem
this spec addresses.

## Out of scope, deliberately: the gallery

The gallery keeps its Amazon URLs.

- There is **no concealment to win** — eBay copies the image to its own servers,
  so the Amazon URL never reaches a buyer. Confirmed by the operator on
  2026-09-24 against a live listing: the gallery image resolves to
  `i.ebayimg.com`.
- There is a **real risk to take on**. eBay fetches the gallery URL
  *synchronously during publish*; a slow or unavailable origin fails
  `bulk_publish_offer` outright. The description image, by contrast, is fetched
  by the buyer's browser long after publish, so an outage there degrades the
  description and nothing else.

Putting the same mirror on both surfaces would convert a cosmetic failure mode
into one that stops listing creation. A guard spec locks the gallery payload
against rewriting.

## Decisions

### D1 — One image per listing, enforced structurally

The cost model assumes exactly one image per listing. That assumption is made
true rather than hoped for:

- `images` is removed from `LISTING_TEMPLATE_PLACEHOLDERS` **entirely**, not
  merely from the seller-offered `LISTING_TEMPLATE_SAFE_PLACEHOLDERS`. Operator
  decision (2026-09-24): a custom template must not be able to render the full
  image set either.
- `has_images` is removed from `LISTING_TEMPLATE_PRESENCE_FLAGS` with it. It
  exists only to wrap an `{{#images}}` list; leaving it behind would let a
  custom template render an empty but styled wrapper.
- `gallery-grid` (migration `072`, the one catalog template using the image
  loop) is soft-retired with `is_active = FALSE` in a new migration. Catalog
  rows are never DELETEd — there is no FK protecting them.
- Removing `images` from the const array narrows the `ListingTemplatePlaceholder`
  union, so every remaining reference to it fails to compile. The cleanup is
  enforced by the type checker, not by grep.

The 12 live templates (migration `073`, renamed by `115`) already carry exactly
one `{{#main_image}}` each, so no seller-visible template changes shape.

`stripUnresolvedPlaceholders` already removes a section whose key is absent from
the context, so an existing custom template carrying `{{#images}}` renders
nothing. No migration over user-authored templates is required.

### D2 — The Amazon image URL can never enter a description

`main_image` resolves to the mirrored URL, or to the **empty string**. It never
falls back to the Amazon URL. Operator decision (2026-09-24).

A fallback was considered and rejected. The description is written once at
publish and never revised, so a single fallback permanently exposes the supplier
on that listing — the exact outcome the feature exists to prevent. An empty
`{{#main_image}}` section renders nothing at all: the listing loses one
in-description picture while the eBay gallery still shows every photo.

This makes the property structural rather than behavioural, so a guard spec can
assert that no Amazon image host can reach a rendered description.

### D3 — Amazon performs the resize; there is no transform component

Verified live on 2026-09-24 against a real Keepa image id (`71nx65qZq6L`):

| URL | Bytes |
|---|---|
| `.../images/I/71nx65qZq6L.jpg` | 185,303 |
| `.../images/I/71nx65qZq6L._SL800_.jpg` | **45,132** |
| `.../images/I/71nx65qZq6L._SL400_.jpg` | 16,099 |

Amazon's image server honours size modifiers in the filename, so the mirror is a
**byte copy** of an already-correctly-sized image. No imgproxy container, no
libvips, no transform CPU. `_SL800_` is the chosen variant: an 800px maximum
dimension covers eBay's description width with headroom, at ~45 KB.

Amazon also returns `Cache-Control: max-age=630720000, public`, which is copied
onto the mirrored object.

WebP was tested and is not available — Amazon returns JPEG regardless of the
`Accept` header. Converting would reintroduce the transform component for a
marginal saving on a 45 KB file, so it is not done.

### D4 — The object key is derived, so there is no mapping table

`keepa-normalizer.ts:292` builds every image URL as
`https://images-na.ssl-images-amazon.com/images/I/${name}`. The Keepa filename
is therefore the image's entire identity, which means:

- the R2 key is the filename — **no ID table, no mapping, no lookup**;

Note that the Keepa name **already carries its extension** (`71nx65qZq6L.jpg`),
since it is interpolated straight into the URL. So the two derivations differ:
the R2 key is the name verbatim, while the source URL is built by splitting on
the final dot and inserting the size modifier — `71nx65qZq6L.jpg` becomes
`71nx65qZq6L._SL800_.jpg`. A name with no dot, or one failing
`isValidKeepaImageName`, is not mirrored at all.

- the same physical image used by many ASINs and many sellers is **one object**,
  so deduplication is free rather than engineered;
- the URL is knowable without a database round-trip on the render path.

### D5 — R2 behind a custom domain, not a proxy on our VPS

The read path contains no SellerHill component:

```
buyer  ->  Cloudflare CDN  ->  R2
```

Verified against Cloudflare's current documentation (R2 -> Public Buckets, page
updated 2026-06-16): an R2 bucket can be bound to a custom domain in the same
account **with no Worker**, and a custom domain is what enables Cloudflare Cache,
WAF and Bot Management on it. Public buckets do not permit listing at the root,
so the key space is not enumerable.

Alternatives evaluated and rejected:

- **imgproxy on the Coolify VPS, cached only by Cloudflare.** Cloudflare's cache
  is per-PoP; long-tail objects evict, and every eviction costs an Amazon fetch
  plus a transform. It also contends for the 4 vCPU the Playwright pool already
  uses, and concentrates millions of monthly requests on one datacenter IP that
  Amazon may throttle.
- **imgproxy plus an nginx disk cache.** Strictly better than the above, and
  dominated by R2: it still runs a container on the publish-adjacent host and
  still leaves the read path dependent on our VPS.
- **Images in Postgres.** Rejected on the system-of-record principle. These
  images are fully regenerable from `products.asin`; paying `pg_dump`, WAL and
  replication costs for regenerable data spends the most expensive resource in
  the stack on the cheapest need. Concretely it would add ~45 GB to every daily
  logical backup, amplify WAL during bulk listing creation, evict the real
  working set from `shared_buffers`, and hold a `pg` pool connection for the
  duration of each image transfer. The codebase already applies this split:
  `fulfillment-evidence/` and `.browser-state/profiles/` live on disk with
  lifecycles, not in the database.

At ~1M distinct products x 45 KB (~45 GB), R2 costs roughly $1-2/month all in
(storage, writes, reads on cache miss; R2 charges no egress). Exact figures to
be confirmed against current pricing before go-live.

## Architecture

```
WRITE (once per product, on the create path)
  resolveProductData
    -> GET  images-na.ssl-images-amazon.com/images/I/<name>._SL800_.jpg
    -> PUT  r2://<bucket>/<name>.jpg          (Cache-Control copied from source)
    -> UPDATE products SET image_mirrored_at = NOW()

RENDER (publish path)
  main_image = image_mirrored_at IS NULL ? '' : IMAGE_CDN_BASE_URL + '/' + name

READ (hot)
  buyer -> Cloudflare -> R2

GC (daily reconcile)
  live product image names  <-compare->  R2 keys  ->  delete orphans
```

### Ordering: the mirror is awaited, not fire-and-forget

D2 makes ordering load-bearing. `processDescriptionTemplate` runs at
`listing-strategy.service.ts:61`; if the mirror were a background job, a listing
created before it completed would publish with no image **permanently**, since
descriptions are never revised.

The mirror therefore runs inside `resolveProductData` and is awaited, on both
branches:

- **cache miss** — the product is being created anyway, behind the existing
  per-ASIN advisory lock and alongside a Keepa call, so the mirror rides an
  existing round-trip;
- **cache hit with `image_mirrored_at IS NULL`** — a pre-mirror product, or one
  whose previous mirror failed. Retried here, so a transient failure is repaired
  by the next listing for that ASIN rather than persisting.

A product already mirrored costs one indexed column read and nothing else.

## Components

| Area | Change |
|---|---|
| `packages/shared/src/utils/listing-template.ts` | Remove `images` from `LISTING_TEMPLATE_PLACEHOLDERS`; remove `has_images` from `LISTING_TEMPLATE_PRESENCE_FLAGS` and from `buildListingTemplateContext`; delete the `images` branch of `buildListingTemplateSnippet` and its comment; `ListingTemplateInput` gains `mainImageUrl?: string`, and `main_image` resolves to it or to the empty string |
| `packages/shared` (new) | `buildMirroredImageUrl(name, baseUrl)` and `isValidKeepaImageName(name)` — pure, name matched against a strict character/length bound |
| migration | `products.image_mirrored_at TIMESTAMPTZ NULL` |
| migration | soft-retire `gallery-grid` (`is_active = FALSE`) |
| `apps/api` (new module) | `ImageMirrorService` — HEAD/PUT to R2, idempotent, fail-soft; `ImageMirrorGcService` — daily reconcile |
| `listing-processor.service.ts` | `resolveProductData` awaits the mirror on both branches |
| `listing-strategy.service.ts` | Passes `mainImageUrl` (mirrored, or empty) into the template context |
| web template preview | Passes `mainImageUrl` too; the preview may use the Amazon URL, since it is seller-facing and never published. Same renderer, different input — the one-renderer rule is preserved |
| `apps/api/src/modules/listings/listing-template.spec.ts` | `has_images` assertions removed |

## Failure handling

- **Mirror fails** — `image_mirrored_at` stays NULL and the description renders
  with no image. The listing publishes normally and the gallery is unaffected.
  Logged at `warn`, retried on the next listing for that ASIN.
- **Mirror throws** — swallowed. Listing creation is never blocked by an image.
- **R2 unavailable** — Cloudflare serves cached objects; cold objects 404. The
  description image is missing; nothing else is affected.
- **GC cannot read `products`** — the sweep **aborts**. Treating a database
  outage as "no products exist" would delete the entire bucket. This mirrors
  `BrowserProfileGcService`, which aborts for the same reason.

## Configuration

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`IMAGE_CDN_BASE_URL` — all **env-only**, never registry or panel settings.

The credentials are provider credentials, which CLAUDE.md already keeps out of
`platform_settings`. `IMAGE_CDN_BASE_URL` is excluded for the separate reason
that already keeps `LLM_BASE_URL` out while `llm.apiKey` is in: an editable
destination lets a compromised admin session repoint every listing image at a
host it controls.

## Testing

Pure and Jest-covered:

- `buildMirroredImageUrl` / `isValidKeepaImageName`
- the GC orphan-set computation
- template rendering with `images` and `has_images` absent

Guard specs (source-grep, in the style of `tracking-webhook-coverage.guard.spec.ts`):

- no Amazon image host can reach a rendered description — `main_image` is
  mirrored-or-empty on the publish path (D2)
- the gallery payload is never rewritten (out-of-scope rule)
- `images` and `has_images` are absent from the placeholder and presence-flag
  constants (D1)

## Before go-live

1. ~~Confirm the gallery image resolves to `i.ebayimg.com`.~~ Done —
   operator-verified against a live listing, 2026-09-24.
2. Confirm current R2 pricing.
3. Bind the image domain to the bucket; confirm `.jpg` is covered by
   Cloudflare's default cached extensions, and enable the tiered cache topology
   Cloudflare's R2 documentation recommends.
4. Backfill: mirror existing products once, then verify a sample of live
   descriptions.

## Known limitation

A seller who cancels leaves their listings live on eBay, so their products — and
therefore their mirrored images — keep being served with no revenue behind them.
The product reference-count delete at `listings.service.ts:2189` fires only on
explicit listing deletion, not on `INACTIVE`, plan-limit retirement or account
cascade, so the GC reconcile is what eventually collects these. At ~$1-2/month
for the whole bucket this is accepted rather than engineered around.
