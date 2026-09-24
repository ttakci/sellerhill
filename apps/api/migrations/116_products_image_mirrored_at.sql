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
