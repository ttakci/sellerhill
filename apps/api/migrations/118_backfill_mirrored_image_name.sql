-- Backfill for rows stamped before `117` existed.
--
-- `117` added `products.mirrored_image_name`, written by `ensureMirrored` in
-- the SAME statement that stamps `image_mirrored_at`. But a row stamped by
-- the OLD single-column `UPDATE products SET image_mirrored_at = NOW()` (the
-- code that shipped before this fix) has `image_mirrored_at` set and
-- `mirrored_image_name` permanently NULL — no code path after `117` can ever
-- populate it, because `attachMirroredImage`'s `alreadyMirrored` check reads
-- only `image_mirrored_at`, and `ensureMirrored` short-circuits on that before
-- it ever reaches the UPDATE that would write the name.
--
-- Left alone, `loadLiveNames()` (`WHERE mirrored_image_name IS NOT NULL`)
-- would never see such a row's real object key: it would look orphaned, be
-- old enough to clear the 48h safety margin, and get deleted while a live
-- listing still embeds it.
--
-- The derivation below reads `image_urls->>0` — the very mutable column
-- Finding 2 established the live set cannot trust going forward. That is
-- deliberate and safe ONLY here: for a row already stamped mirrored before
-- `117` existed, `image_urls->>0` is the best evidence available of what was
-- actually mirrored (Amazon's primary image had not yet had a chance to
-- rotate underneath a brand-new install), and it is strictly better than
-- leaving the name NULL, which reads as "delete it". This is a one-time,
-- TRANSITIONAL repair, not the ongoing mechanism — every row stamped by the
-- current code already carries the real name from the upload itself, in the
-- same statement as the watermark, and can never disagree with it.
--
-- `split_part(text, text, integer)` with a negative `n` (count from the end)
-- requires Postgres 14+; this schema already assumes 16+ (see
-- docker-compose.yml's `pgvector/pgvector:0.8.1-pg16`), so it is safe here.
--
-- Idempotent: only touches rows that are stamped mirrored but still have no
-- name, so this is safe to run whether or not `117` has already landed
-- everywhere. `117` is the previous migration and is left untouched.

UPDATE products
   SET mirrored_image_name = split_part(image_urls->>0, '/', -1)
 WHERE image_mirrored_at IS NOT NULL
   AND mirrored_image_name IS NULL
   AND image_urls->>0 IS NOT NULL
   AND split_part(image_urls->>0, '/', -1) <> '';
