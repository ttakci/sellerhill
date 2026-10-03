// apps/api/src/modules/best-sellers/best-sellers-crawl.helpers.ts
//
// Pure helpers behind `BestSellersCrawlService`: how a frontier entry is
// written into Redis and read back, which nodes of one sidebar answer are the
// browsed node's CHILDREN (the next nodes to visit), and when a new pass
// starts. No Redis, no settings, no HTTP — all of it is exercised by the spec.

import {
  BEST_SELLERS_LIST_TYPE_ORDER,
  BEST_SELLERS_ROOT_CATEGORY,
  type BestSellersCategoryDto,
  type BestSellersListType,
} from '@repo/shared';

/** One node waiting in a crawl frontier. */
export interface CrawlItem {
  listType: BestSellersListType;
  /** Category alias, `''` for the root. */
  category: string;
  /** 0 = the root page, 1 = a department, … */
  depth: number;
  /** Transient failures (blocked, timed out behind busier lanes) already spent on it this pass. */
  attempt: number;
}

/** A node the scraper could not reach is put back this many times per pass, then left for the next pass. */
export const CRAWL_MAX_ATTEMPTS = 5;

/** `listType|depth|attempt|category` — the category goes last because it is the only part that may hold `|`-free free text. */
export function encodeCrawlItem(item: CrawlItem): string {
  return `${item.listType}|${item.depth}|${item.attempt}|${item.category}`;
}

/** The inverse of `encodeCrawlItem`; null for anything this version did not write. */
export function decodeCrawlItem(raw: string): CrawlItem | null {
  const parts = raw.split('|');
  if (parts.length !== 4) {return null;}
  const [listType, depth, attempt, category] = parts;
  if (!BEST_SELLERS_LIST_TYPE_ORDER.includes(listType as BestSellersListType)) {return null;}
  const d = Number(depth);
  const a = Number(attempt);
  if (!Number.isInteger(d) || d < 0 || !Number.isInteger(a) || a < 0) {return null;}
  return { listType: listType as BestSellersListType, category, depth: d, attempt: a };
}

/** The identity of a node within a pass (a node is visited once per pass, whatever its depth). */
export function crawlNodeKey(item: Pick<CrawlItem, 'listType' | 'category'>): string {
  return `${item.listType}|${item.category}`;
}

/**
 * The children of the browsed node in one sidebar answer — the nodes to visit
 * next. With levels: the rows one level below the selected row that follow
 * it (on a leaf there are none: the rows around it are its SIBLINGS, which
 * the parent's visit already queued). Without levels (a scraper image older
 * than the level field): everything after the selected row, as the tree used
 * to be read; a sibling then gets queued twice, and the per-pass seen-set
 * drops the repeat.
 */
export function childPathsOf(categories: readonly BestSellersCategoryDto[], category: string): string[] {
  const leveled = categories.length > 0 && categories.every((entry) => typeof entry.level === 'number');
  const withPath = (entry: BestSellersCategoryDto): entry is BestSellersCategoryDto & { path: string } =>
    !entry.isRoot && !!entry.path && entry.path !== category;

  if (category === BEST_SELLERS_ROOT_CATEGORY) {
    const departments = categories.filter(withPath);
    if (!leveled) {return departments.map((entry) => entry.path);}
    const top = Math.min(...departments.map((entry) => entry.level as number));
    return departments.filter((entry) => entry.level === top).map((entry) => entry.path);
  }

  const selectedIndex = categories.findIndex((entry) => entry.isSelected && !entry.isRoot);
  if (selectedIndex < 0) {return [];}
  const after = categories.slice(selectedIndex + 1);
  if (!leveled) {return after.filter(withPath).map((entry) => entry.path);}

  const level = categories[selectedIndex].level as number;
  const children: string[] = [];
  for (const entry of after) {
    if ((entry.level as number) <= level) {break;}
    if (entry.level === level + 1 && withPath(entry)) {children.push(entry.path);}
  }
  return children;
}

/** A pass starts when none ran yet, or the last one started at least `intervalMs` ago. */
export function shouldStartPass(startedAtMs: number | null, nowMs: number, intervalMs: number): boolean {
  return startedAtMs === null || !Number.isFinite(startedAtMs) || nowMs - startedAtMs >= intervalMs;
}
