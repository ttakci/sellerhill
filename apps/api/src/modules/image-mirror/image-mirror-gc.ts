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
