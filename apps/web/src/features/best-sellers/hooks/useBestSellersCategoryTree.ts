/**
 * useBestSellersCategoryTree
 *
 * The API has no "give me the whole tree" endpoint — every fetch answers for
 * ONE category and returns the sidebar Amazon rendered beside it: the chain
 * above that category, the category itself and its children. Two kinds of
 * answer feed it: the list the seller OPENED (a label click, products and
 * all) and the tree alone (`GET /best-sellers/categories?category=`) that a
 * chevron asks for — so walking down to a deep branch costs no products of
 * the allowance until the seller opens the one they want. This hook is the
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

import { useGetBestSellersCategoriesQuery, useLazyGetBestSellersCategoriesQuery } from '../api/bestSellersApi';
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

  const isExpanded = (path: string): boolean => {
    const isDefaultOpen = chain.includes(path);
    return toggled.has(path) ? !isDefaultOpen : isDefaultOpen;
  };
  const flip = (path: string): void => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const [fetchBranch] = useLazyGetBestSellersCategoriesQuery();
  const [loadingPaths, setLoadingPaths] = useState<ReadonlySet<string>>(new Set());
  const setLoading = (path: string, loading: boolean): void => {
    setLoadingPaths((prev) => {
      const next = new Set(prev);
      if (loading) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  };

  const expandBranch = (path: string): void => {
    if (isExpanded(path) || bucket.nodes[path]?.children !== undefined) {
      flip(path);
      return;
    }
    if (loadingPaths.has(path)) {
      return;
    }
    // The answer may land after the seller switched list type: fold it into
    // the list type it was asked for.
    const requestedListType = listType;
    setLoading(path, true);
    fetchBranch({ listType: requestedListType, category: path }, true)
      .unwrap()
      .then((answer) => {
        if (answer.categories.length > 0) {
          setByListType((prev) => ({
            ...prev,
            [requestedListType]: mergeCategoryAnswer(
              prev[requestedListType] ?? EMPTY_CATEGORY_BUCKET,
              path,
              answer.categories,
            ),
          }));
          flip(path);
        }
      })
      // A refused or blocked answer leaves the branch closed with its
      // chevron, so the seller can simply try again.
      .catch(() => undefined)
      .finally(() => setLoading(path, false));
  };

  return {
    bucket,
    isExpanded,
    expandBranch,
    isBranchLoading: (path) => loadingPaths.has(path),
  };
}
