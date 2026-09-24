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

/**
 * Minimum object age before the GC will consider deleting it. 48 hours is
 * comfortably longer than any realistic gap between an upload and its
 * watermark commit — see `isObjectOldEnoughToDelete`.
 */
export const GC_MIN_OBJECT_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Whether a listed object is old enough for the GC to safely delete.
 *
 * A just-uploaded image can lose a race: `ImageMirrorService.ensureMirrored`
 * uploads the object to the bucket, THEN commits the watermark
 * (`image_mirrored_at` / `mirrored_image_name`) that makes it appear in the
 * live set. If the GC's read of the live set lands in that window, the
 * brand-new object is absent from `liveNames` and looks orphaned — and
 * deleting it is permanent, because once the watermark commits,
 * `ensureMirrored`'s reuse path (a non-null stored `mirrored_image_name`)
 * never re-uploads. Requiring an object to be older than a safety margin
 * before it is even a deletion candidate closes that window.
 *
 * A missing `LastModified` is treated as NOT old enough: absence of evidence
 * that an object is old is not evidence that it is.
 */
export function isObjectOldEnoughToDelete(
  lastModified: Date | undefined,
  now: Date,
  minAgeMs: number = GC_MIN_OBJECT_AGE_MS
): boolean {
  if (!lastModified) {
    return false;
  }
  return now.getTime() - lastModified.getTime() >= minAgeMs;
}
