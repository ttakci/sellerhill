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
