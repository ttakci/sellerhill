-- Drops the Cloudflare R2 image-mirror watermark columns.
--
-- `image_mirrored_at` (116) and `mirrored_image_name` (117) tracked one
-- mirrored image per product for the description's own <img> tag — the only
-- surface the mirror ever covered, because eBay was believed to re-host the
-- gallery itself. That belief was wrong (see migration 119's header): eBay
-- serves whatever URL we hand it for the gallery too, so the mirror closed
-- one leak of twenty-five.
--
-- eBay Picture Services (migration 119, `product_ebay_images`) replaces it
-- for both surfaces and needs no watermark of this shape: eBay owns the
-- storage once an image is uploaded, and it expires an unused image itself
-- after 30 days, so there is nothing here for us to track or garbage-collect.
--
-- 116, 117 and 118 are not edited — an applied migration is never amended.

ALTER TABLE products
    DROP COLUMN IF EXISTS image_mirrored_at,
    DROP COLUMN IF EXISTS mirrored_image_name;

DROP INDEX IF EXISTS idx_products_image_not_mirrored;
