-- The live set for the image-mirror GC has to be what was actually embedded
-- in a published description, not what `products.image_urls` currently says.
--
-- `image_urls` is overwritten on every Keepa refresh tick (default every 12h),
-- and its first entry changes whenever Amazon rotates an ASIN's primary image.
-- The eBay description, though, is rendered once at publish and is never
-- revised afterwards — it still names the OLD image. Deriving the live set
-- from `image_urls->>0` (as migration 116 originally intended) means a
-- routine Amazon image rotation makes the GC read the new name, decide the
-- old one looks orphaned, and delete an object a live listing still needs.
--
-- `mirrored_image_name` records the name actually mirrored, written in the
-- same statement that stamps `image_mirrored_at` (116). A product is mirrored
-- exactly once — `ensureMirrored`'s `alreadyMirrored` branch never re-uploads
-- — so this column is effectively write-once: the description and the bucket
-- object it points at can never disagree, and when the product row is later
-- deleted by the reference-count path (`listings.service.ts`) the name goes
-- with it and the object becomes a genuine orphan for the GC to collect.
--
-- 116 is the previous migration and is left untouched.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS mirrored_image_name TEXT;
