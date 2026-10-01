/**
 * useBestSellersCategoryTree
 *
 * The API has no "give me the whole tree" endpoint — every fetch answers for
 * ONE category and returns the sidebar Amazon rendered beside it: the chain
 * above that category, the category itself and its children. This hook is the
 * client-side cache that turns a series of those single-node answers into a
 * tree (`mergeCategoryAnswer`, pure and tested), per list type — Movers &
 * Shakers does not carry the same departments as Best Sellers.
 *
 * A page opened straight into a category (deep link, reload, back button)
 * never saw the root answer, so the department level would be empty. Then,
 * and only then, the hook asks `GET /best-sellers/categories` for the root
 * department list alone: no products, so nothing is taken from the seller's
 * allowance for a list they did not open.
 */
import { BEST_SELLERS_ROOT_CATEGORY, type BestSellersCategoryDto, type BestSellersListType } from '@repo/shared';
import { useState } from 'react';

import { useGetBestSellersCategoriesQuery } from '../api/bestSellersApi';
import type { BestSellersCategoryTreeListTypeBucket, BestSellersCategoryTreeState } from '../bestSellers.types';
import { EMPTY_CATEGORY_BUCKET, activeChain, mergeCategoryAnswer } from '../utils/bestSellersCategoryTree';

export { departmentOfCategory } from '../utils/bestSellersCategoryTree';

export function useBestSellersCategoryTree(
  listType: BestSellersListType,
  category: string,
  /** `currentData?.list?.categories` — undefined while loading, `[]` when Amazon rendered no tree. */
  freshCategories: BestSellersCategoryDto[] | undefined,
): BestSellersCategoryTreeState {
  const [byListType, setByListType] = useState<Partial<Record<BestSellersListType, BestSellersCategoryTreeListTypeBucket>>>(
    {},
  );
  const [lastMerged, setLastMerged] = useState<BestSellersCategoryDto[] | undefined>(undefined);
  const [lastRootMerged, setLastRootMerged] = useState<BestSellersCategoryDto[] | undefined>(undefined);

  // Adjusted during render — the same pattern the page container already uses
  // for its own "last known categories" state — so a fresh answer is cached
  // without an extra effect-driven render pass. RTK Query hands back the same
  // array for the same cached answer, so identity says "already folded in".
  if (freshCategories && freshCategories.length > 0 && freshCategories !== lastMerged) {
    setLastMerged(freshCategories);
    setByListType((prev) => ({
      ...prev,
      [listType]: mergeCategoryAnswer(prev[listType] ?? EMPTY_CATEGORY_BUCKET, category, freshCategories),
    }));
  }

  // Department level still unknown on a non-root page: fetch it on its own.
  // Skipped the moment departments are cached, so it runs at most once per
  // list type and session, and never on the root page (which carries them).
  const hasDepartments = (byListType[listType]?.rootChildren?.length ?? 0) > 0;
  const { currentData: rootAnswer } = useGetBestSellersCategoriesQuery(
    { listType },
    { skip: category === BEST_SELLERS_ROOT_CATEGORY || hasDepartments },
  );
  const rootDepartments = rootAnswer?.categories;
  if (!hasDepartments && rootDepartments && rootDepartments.length > 0 && rootDepartments !== lastRootMerged) {
    setLastRootMerged(rootDepartments);
    setByListType((prev) => ({
      ...prev,
      [listType]: mergeCategoryAnswer(prev[listType] ?? EMPTY_CATEGORY_BUCKET, BEST_SELLERS_ROOT_CATEGORY, rootDepartments),
    }));
  }

  const bucket = byListType[listType] ?? EMPTY_CATEGORY_BUCKET;
  const chain = activeChain(bucket, category);
  const chainKey = chain.join('|');

  // A node is open by default when it sits on the active chain (the browsed
  // category and everything above it), so a deep link or a pick always shows
  // its own branch. `toggled` holds the nodes the seller flipped away from
  // that default. Browsing somewhere new clears the flips for the NEW chain —
  // a stale "collapsed" must not hide the branch the seller just opened —
  // and leaves unrelated nodes the seller opened by hand alone.
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const [lastChainKey, setLastChainKey] = useState(chainKey);
  if (lastChainKey !== chainKey) {
    setLastChainKey(chainKey);
    if (chain.some((path) => toggled.has(path))) {
      setToggled(new Set([...toggled].filter((path) => !chain.includes(path))));
    }
  }

  return {
    bucket,
    isExpanded: (path) => {
      const isDefaultOpen = chain.includes(path);
      return toggled.has(path) ? !isDefaultOpen : isDefaultOpen;
    },
    toggleExpanded: (path) => {
      setToggled((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
  };
}
