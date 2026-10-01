/**
 * Pure helpers behind the Best Sellers category tree.
 *
 * Every answer from the API is about ONE category and carries the sidebar
 * Amazon rendered beside it, as a flat list in document order:
 *
 *   Any Department            (isRoot)
 *   ‹ Electronics             (an ancestor — an anchor, so it has a path)
 *   ‹ Accessories             (…one entry per level above the browsed node)
 *   Headphones                (the browsed node — NOT an anchor, so no path, isSelected)
 *   Earbuds, Over-Ear, …      (its children, anchors)
 *
 * At the root the list is just the departments. Reading it by POSITION around
 * the selected entry (ancestors before, children after) is what keeps a
 * visited node, its parent and its children each in their own place — the
 * previous two-level cache treated every answer as "the children of the
 * department", so visiting a sub-category replaced its siblings with its own
 * children and the node the seller pressed vanished.
 */

import { BEST_SELLERS_ROOT_CATEGORY, type BestSellersCategoryDto } from '@repo/shared';

import type { BestSellersCategoryNode, BestSellersCategoryTreeListTypeBucket } from '../bestSellers.types';

export const EMPTY_CATEGORY_BUCKET: BestSellersCategoryTreeListTypeBucket = { rootChildren: undefined, nodes: {} };

/** A category alias's department is its first path segment. */
export function departmentOfCategory(category: string): string {
  const slashIndex = category.indexOf('/');
  return slashIndex === -1 ? category : category.slice(0, slashIndex);
}

type CategoryWithPath = BestSellersCategoryDto & { path: string };

const hasPath = (entry: BestSellersCategoryDto): entry is CategoryWithPath => !!entry.path && !entry.isRoot;

/** Adds or renames a node without losing what is already known about its children. */
function upsertNode(
  nodes: Record<string, BestSellersCategoryNode>,
  path: string,
  name: string,
  parent: string | null,
): void {
  nodes[path] = { name, parent, children: nodes[path]?.children };
}

/**
 * Folds one answer into the cache and returns the new cache. Returns the SAME
 * object when the answer carries nothing usable (no tree, or no selected
 * entry to anchor the children on), so callers can skip a state update.
 */
export function mergeCategoryAnswer(
  bucket: BestSellersCategoryTreeListTypeBucket,
  category: string,
  entries: readonly BestSellersCategoryDto[],
): BestSellersCategoryTreeListTypeBucket {
  const nodes = { ...bucket.nodes };

  if (category === BEST_SELLERS_ROOT_CATEGORY) {
    const departments = entries.filter(hasPath);
    if (departments.length === 0) {
      return bucket;
    }
    departments.forEach((entry) => upsertNode(nodes, entry.path, entry.name, null));
    return { rootChildren: departments.map((entry) => entry.path), nodes };
  }

  const selectedIndex = entries.findIndex((entry) => entry.isSelected);
  if (selectedIndex < 0) {
    return bucket;
  }

  // The chain above the browsed node, top-down. A missing chain still has a
  // parent: the department the alias itself names.
  let parent: string | null = null;
  entries
    .slice(0, selectedIndex)
    .filter(hasPath)
    .forEach((ancestor) => {
      upsertNode(nodes, ancestor.path, ancestor.name, parent ?? nodes[ancestor.path]?.parent ?? null);
      parent = ancestor.path;
    });
  const department = departmentOfCategory(category);
  const selectedParent = parent ?? (department !== category ? department : null);

  const children = entries.slice(selectedIndex + 1).filter((entry): entry is CategoryWithPath => hasPath(entry) && entry.path !== category);
  children.forEach((child) => upsertNode(nodes, child.path, child.name, category));
  nodes[category] = {
    name: entries[selectedIndex].name,
    parent: selectedParent,
    children: children.map((child) => child.path),
  };

  return { rootChildren: bucket.rootChildren, nodes };
}

/** The active node and everything above it, top-down (`[]` at the root). */
export function activeChain(bucket: BestSellersCategoryTreeListTypeBucket, category: string): string[] {
  if (category === BEST_SELLERS_ROOT_CATEGORY) {
    return [];
  }
  const chain: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = category;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    chain.unshift(cursor);
    const node: BestSellersCategoryNode | undefined = bucket.nodes[cursor];
    if (node) {
      cursor = node.parent;
    } else {
      cursor = cursor.includes('/') ? departmentOfCategory(cursor) : null;
    }
  }
  return chain;
}

/** A pure view model of one tree row — the container only adds strings. */
export interface CategoryTreeRowModel {
  path: string;
  name: string;
  depth: number;
  isActive: boolean;
  /** An ancestor of the browsed node. */
  isActiveBranch: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
}

export interface FlattenCategoryTreeArgs {
  bucket: BestSellersCategoryTreeListTypeBucket;
  category: string;
  isExpanded: (path: string) => boolean;
  /** Lower-cased, trimmed search text; `''` shows the tree. */
  query: string;
}

/**
 * Depth-first rows under the root. With a search query the tree gives way to a
 * flat list of every known node whose name matches. A node on the active chain
 * whose own children are not known yet (a deep link) still shows the next node
 * of the chain, so the browsed category is always visible.
 */
export function flattenCategoryTree({ bucket, category, isExpanded, query }: FlattenCategoryTreeArgs): CategoryTreeRowModel[] {
  const chain = activeChain(bucket, category);
  const chainSet = new Set(chain);

  if (query) {
    return Object.entries(bucket.nodes)
      .filter(([, node]) => node.name.toLowerCase().includes(query))
      .map(([path, node]) => ({
        path,
        name: node.name,
        depth: 0,
        isActive: path === category,
        isActiveBranch: chainSet.has(path) && path !== category,
        hasChildren: false,
        isExpanded: false,
      }));
  }

  const rows: CategoryTreeRowModel[] = [];
  const visit = (path: string, depth: number, trail: ReadonlySet<string>): void => {
    const node = bucket.nodes[path];
    if (!node || trail.has(path)) {
      return;
    }
    const chainNext = chain[chain.indexOf(path) + 1];
    const children = node.children ?? (chainSet.has(path) && chainNext ? [chainNext] : undefined);
    const open = isExpanded(path);
    rows.push({
      path,
      name: node.name,
      depth,
      isActive: path === category,
      isActiveBranch: chainSet.has(path) && path !== category,
      hasChildren: node.children === undefined || node.children.length > 0,
      isExpanded: open,
    });
    if (open && children) {
      const nextTrail = new Set(trail).add(path);
      children.forEach((child) => visit(child, depth + 1, nextTrail));
    }
  };

  const top = bucket.rootChildren ?? (chain.length > 0 ? [chain[0]] : []);
  top.forEach((path) => visit(path, 0, new Set()));
  return rows;
}
