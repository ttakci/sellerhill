# Serving listing images from eBay Picture Services

Date: 2026-09-25
Status: approved scope, spec under review
Supersedes: [2026-09-24-listing-image-mirror-design.md](2026-09-24-listing-image-mirror-design.md)

## Problem

Every image on a listing this system publishes is served from Amazon, so the
supplier's domain is in the page source of every live listing.

| Surface | Images | Serves from | Fixed by the R2 mirror? |
|---|---|---|---|
| Gallery (`product.imageUrls`) | up to `EBAY_MAX_IMAGES` (24) | `images-na.ssl-images-amazon.com` | **No** |
| Description (`{{main_image}}`) | 1 | `img.sellerhill.com` | Yes |

The R2 mirror shipped on 2026-09-24 closes the description and nothing else. It
was built on the belief that eBay ingests `imageUrls` at publish and re-hosts
them, so the gallery had nothing to hide. **That belief was false** — verified
against a live listing, whose gallery image is
`https://images-na.ssl-images-amazon.com/images/I/9106K0FD50L.jpg`, the raw
Keepa URL. The evidence that appeared to confirm it came from a listing the
operator had created by hand, not one this system published.

So the mirror closes one image and leaves up to twenty-four open, on the surface
a buyer looks at first.

## Why not extend the R2 mirror to the gallery

It would work, and it is the wrong shape:

- **It advertises the tool.** `img.sellerhill.com` hides the supplier but tells
  any competitor reading the source which platform the seller runs on. On the
  description that is one image; on the gallery it is every image of every
  listing.
- **Storage grows 24×.** One mirrored image per product becomes up to
  twenty-four.
- **It keeps the garbage collector**, the only code in the feature that deletes
  data and the part that needed three fix rounds to get right.

## Decisions

### D1 — eBay Picture Services serves both surfaces

Each product image is uploaded once to EPS through the Media API's
`createImageFromUrl`, and the returned `i.ebayimg.com` URL is used as BOTH the
gallery image and the description image.

Measured against production on 2026-09-24, not inferred:

| | |
|---|---|
| eBay accepts an Amazon-hosted `imageUrl` | **Yes — HTTP 201** |
| Image host | `https://apim.ebay.com/commerce/media/v1_beta` |
| Returned URL | `https://i.ebayimg.com/00/s/…/$_1.JPG?set_id=…` |
| Stored dimensions | 1368×1232 (encoded in the URL path) |
| `expirationDate` for an unused image | exactly 30 days |

`i.ebayimg.com` is the domain a buyer already expects on an eBay listing, so
unlike our own domain it carries no signal at all.

### D2 — Nothing is ever deleted, because eBay collects its own garbage

The Media API has **no delete method for images** — confirmed against the
OpenAPI document, where only `post_order` documents expose `DELETE`. An unused
EPS image expires by itself after 30 days.

This is the decision that most improves on the R2 design. The mirror needed
`ImageMirrorGcService`, a bounded-list-and-delete sweep with two abort
conditions, a 48-hour age margin and a backfill migration, because we owned the
storage and therefore owned the orphans. Here we own neither. **No GC ships with
this feature and none is needed** — and with it goes the only code path in the
image pipeline capable of destroying something a live listing needs.

### D3 — One upload per (product × eBay store), remembered

EPS images belong to a seller's account, while `products` is a shared
ASIN-keyed cache. Two stores listing the same ASIN need two uploads.

The upload is therefore keyed on `(product_id, ebay_account_id)` and the
resulting URLs are stored. The first listing of a product in a store pays for
the uploads; every later listing of that product in that store pays nothing.

### D4 — Read the URL from the create response, fall back to `getImage`

The OpenAPI document declares `createImageFromUrl`'s 201 body as an
`ImageResponse` — the same type `getImage` returns, carrying `imageUrl`,
`maxDimensionImageUrl` and `expirationDate`. If the body really is populated,
each image costs **one** call rather than two.

The probe did not print the 201 body, so this is unverified. The
implementation reads the body first and calls `getImage` only when the body
lacks a usable `imageUrl`, which is correct either way and resolves the
question on first contact. The report says which path ran.

### D5 — An image never fails a listing

Every upload is best-effort. A failure falls back to that image's Amazon URL for
that listing and publishing continues.

This keeps the rule the R2 mirror already established — a picture must never
block a publish — and it means the worst case of this feature is **the behaviour
we have today**, not a broken listing. The specific failures worth naming, from
the OpenAPI error table: `190204` (eBay could not download the URL), `190201`
(too large), `190202` (dimensions), `190203` (unsupported format), `190013`
(unauthorized), `190000` (eBay internal).

### D6 — The R2 mirror is removed in this same change

Operator decision, 2026-09-25. EPS replaces it outright; the two do not overlap.

**Keeping R2 as a safety net would not buy one**, which is why removing it now
costs nothing. R2 is not a fallback for EPS — they are alternatives that obey
the same rule: when no mirrored URL exists the description renders no image and
never an Amazon URL. So an EPS upload failure produces exactly the same outcome
whether or not R2 is still installed. What an overlap would buy is a second
system doing one job, and the cost of that is paid every time either one is
changed.

Removed here, in full: `ImageMirrorService`, `ImageMirrorGcService`,
`image-mirror-gc.ts` and their specs, `ImageMirrorModule`, the
`mirror-product-images.ts` script and its `mirror:images` entry, the
`image-mirror-gc` queue (including its `ADMIN_QUEUE_NAMES` and
`OBSERVED_QUEUE_NAMES` registrations), the five R2 environment variables from
`.env.example` and both Coolify compose files, the `@aws-sdk/client-s3`
dependency, `ProductData.mainImageMirroredUrl`, `attachMirroredImage`, and the
`image-mirror-invariants` guard spec — which is rewritten against EPS rather
than deleted, because the invariant it protects (no Amazon URL in a rendered
description) survives the change of mechanism.

`products.image_mirrored_at` and `products.mirrored_image_name` are dropped by a
NEW migration. Migrations `116`, `117` and `118` are not edited — an applied
migration never is.

The Cloudflare bucket and the `img.sellerhill.com` binding are outside the
codebase and are the operator's to remove once EPS is verified on live listings.
Nothing in the code refers to them after this change.

## Architecture

```
FIRST listing of a product in a store
  for each image (max EBAY_MAX_IMAGES):
      POST apim.ebay.com/commerce/media/v1_beta/image/create_image_from_url
        { imageUrl: <amazon url> }                     → 201 + ImageResponse
        (if the body carries no imageUrl: GET /image/{id})
  store (product_id, ebay_account_id) → [eps urls]

EVERY listing
  gallery      product.imageUrls = [eps urls]   (falls back to amazon per image)
  description  {{main_image}}    = eps urls[0]  (or empty — see below)

NOTHING deletes. eBay expires unused images after 30 days by itself.
```

### The description keeps its no-fallback rule

`main_image` resolves to an EPS URL or the **empty string**, never to an Amazon
URL. That was an operator decision on 2026-09-24 and it still holds: the
description is written once at publish and never revised, so one fallback
exposes the supplier there permanently.

The gallery is different and *does* fall back per image, because eBay revises
`imageUrls` on every price/stock sync — a gallery image is correctable, a
description is not.

## Rate limits

| | |
|---|---|
| Documented, all Media POSTs | **50 requests / 5 seconds, per user** |
| Daily cap on the image resource | **eBay reports none** |

The second line is measured, not assumed: `getRateLimits` lists
`Image (commerce, v1_beta)` with no rates at all, and still reports none after a
successful upload — so "the quota appears on first use" is ruled out. Either the
resource has no daily cap and is governed solely by the per-user burst limit, or
it is not metered in that report. **Do not write a daily figure for it into the
budget governor.**

The per-user limit is the one that binds: 10 uploads/second for a seller, so a
first-time bulk add of 100 ASINs at 8 images each takes about 80 seconds of
upload time. Uploads are therefore sequential per store and paced, and a 429 is
retried with backoff rather than failing the listing.

## Open risks

1. **The 30-day expiry, for images used only in a description.** eBay's wording
   is "as long as an EPS image is being used in an active listing", and it does
   not define *used*. Our plan makes this moot by using the same URL as the
   gallery picture — the mainstream EPS use case, which must persist or every
   eBay listing's photos would vanish monthly. **It is still inference.** The
   plan carries a verification step: publish one listing with EPS images, then
   re-read `getImage` and confirm `expirationDate` moved or cleared.
2. **The image resource's daily cap is unknown.** Mitigated by D5 — exhausting
   it degrades to today's behaviour rather than breaking anything.
3. **The publish path gains an upload step.** The spec the R2 mirror wrote still
   applies: eBay fetches a gallery URL synchronously at publish, so a slow
   origin delays creation. EPS improves this — the fetch moves to upload time and
   eBay is handed its own URL — but the upload itself is now inside listing
   creation. D5 and the per-store pacing are what keep it bounded.

## Testing

Pure and Jest-covered: the URL/id extraction from the `Location` header and the
201 body, the per-image fallback decision, and the store-scoped cache lookup.

Guard specs, in the established source-grep style:

- the description's `main_image` still never falls back to an Amazon URL
- an upload failure cannot propagate out of listing creation
- no delete call against the Media API exists anywhere

## Before go-live

1. Publish one listing through the new path and confirm the gallery image on the
   live listing resolves to `i.ebayimg.com`, and that the description image does
   too.
2. Re-read `getImage` for one of those images and record what happened to
   `expirationDate`. This is risk 1's verification.
3. Re-run `ebay:limits-probe --api-name image` once real upload volume exists, in
   case a daily figure appears only under load.
4. Only after 1 and 2: remove the Cloudflare bucket and the `img.sellerhill.com`
   custom domain. The code stops referring to them in this change, but leaving
   them standing for a few days costs about a dollar and keeps the rollback
   cheap — a revert of this branch would need them back.
