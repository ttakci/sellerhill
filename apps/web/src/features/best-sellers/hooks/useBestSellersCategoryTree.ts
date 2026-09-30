/**
 * useBestSellersCategoryTree
 *
 * Amazon's own category alias grammar caps a Best Sellers category at two
 * segments — a department (`electronics`) or one sub-category under it
 * (`electronics/172541`), see `BEST_SELLERS_CATEGORY_REGEX`. So the picker is
 * a two-level tree, not an arbitrary-depth one: departments at the root, each
 * department's own sub-categories revealed underneath it once visited.
 *
 * The API has no "give me the whole tree" endpoint — every fetch answers for
 * ONE category and returns the list Amazon rendered beside it (its own
 * sub-categories). This hook is the client-side cache that turns a series of
 * those single-level answers into a tree: the root answer becomes the
 * department list, and every department-scoped answer becomes that
 * department's children, both keyed per list type (Movers & Shakers does not
 * carry the same departments as Best Sellers).
 *
 * A page opened straight into a department (deep link, reload, back button)
 * never saw the root answer, so the department level would be empty. Then,
 * and only then, the hook asks `GET /best-sellers/categories` for the root
 * department list alone: no products, so nothing is taken from the seller's
 * allowance for a list they did not open.
 */
import { BEST_SELLERS_ROOT_CATEGORY, type BestSellersCategoryDto, type BestSellersListType } from '@repo/shared';
import { useState } from 'react';

import { useGetBestSellersCategoriesQuery } from '../api/bestSellersApi';
import type { BestSellersCategoryTreeListTypeBucket, BestSellersCategoryTreeState } from '../bestSellers.types';

/** A category alias's department is its first path segment. */
export function departmentOfCategory(category: string): string {
  const slashIndex = category.indexOf('/');
  return slashIndex === -1 ? category : category.slice(0, slashIndex);
}

export function useBestSellersCategoryTree(
  listType: BestSellersListType,
  category: string,
  /** `currentData?.list?.categories` — undefined while loading, `[]` when Amazon rendered no tree. */
  freshCategories: BestSellersCategoryDto[] | undefined,
): BestSellersCategoryTreeState {
  const [byListType, setByListType] = useState<Partial<Record<BestSellersListType, BestSellersCategoryTreeListTypeBucket>>>(
    {},
  );

  // Adjusted during render — the same pattern the page container already uses
  // for its own "last known categories" state — so a fresh answer is cached
  // without an extra effect-driven render pass.
  if (freshCategories && freshCategories.length > 0) {
    const bucket = byListType[listType];
    if (category === BEST_SELLERS_ROOT_CATEGORY) {
      if (bucket?.departments !== freshCategories) {
        setByListType((prev) => ({
          ...prev,
          [listType]: { departments: freshCategories, childrenByDepartment: prev[listType]?.childrenByDepartment ?? {} },
        }));
      }
    } else {
      const department = departmentOfCategory(category);
      if (bucket?.childrenByDepartment[department] !== freshCategories) {
        setByListType((prev) => ({
          ...prev,
          [listType]: {
            departments: prev[listType]?.departments ?? [],
            childrenByDepartment: { ...(prev[listType]?.childrenByDepartment ?? {}), [department]: freshCategories },
          },
        }));
      }
    }
  }

  // Department level still unknown on a non-root page: fetch it on its own.
  // Skipped the moment departments are cached, so it runs at most once per
  // list type and session, and never on the root page (which carries them).
  const hasDepartments = (byListType[listType]?.departments.length ?? 0) > 0;
  const { currentData: rootAnswer } = useGetBestSellersCategoriesQuery(
    { listType },
    { skip: category === BEST_SELLERS_ROOT_CATEGORY || hasDepartments },
  );
  const rootDepartments = rootAnswer?.categories;
  if (!hasDepartments && rootDepartments && rootDepartments.length > 0) {
    setByListType((prev) => ({
      ...prev,
      [listType]: { departments: rootDepartments, childrenByDepartment: prev[listType]?.childrenByDepartment ?? {} },
    }));
  }

  // Which department is open. Default is "whichever contains the active
  // category" so a deep link or a drawer pick always reveals its own branch;
  // `toggled` holds the departments the seller flipped away from that
  // default. Navigating to a new department clears the overrides — a stale
  // "collapsed" override must not hide the branch the seller just opened.
  const activeDepartment = category === BEST_SELLERS_ROOT_CATEGORY ? null : departmentOfCategory(category);
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set());
  const [lastActiveDepartment, setLastActiveDepartment] = useState<string | null>(activeDepartment);
  if (lastActiveDepartment !== activeDepartment) {
    setLastActiveDepartment(activeDepartment);
    if (toggled.size > 0) {
      setToggled(new Set());
    }
  }

  const bucket = byListType[listType];

  return {
    departments: bucket?.departments ?? [],
    childrenOf: (departmentPath) => bucket?.childrenByDepartment[departmentPath],
    isExpanded: (departmentPath) => {
      const isDefaultOpen = departmentPath === activeDepartment;
      return toggled.has(departmentPath) ? !isDefaultOpen : isDefaultOpen;
    },
    toggleExpanded: (departmentPath) => {
      setToggled((prev) => {
        const next = new Set(prev);
        if (next.has(departmentPath)) {
          next.delete(departmentPath);
        } else {
          next.add(departmentPath);
        }
        return next;
      });
    },
  };
}
