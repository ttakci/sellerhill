/**
 * URL-backed browse position for the Best Sellers page: `?list=&category=&page=`.
 *
 * Keeping it in the query string makes a list shareable and survives a
 * refresh; defaults are omitted so the canonical URL stays `/best-sellers`.
 * Changing the list or the category resets the page — page 2 of one list is
 * not page 2 of another.
 */

import {
  BEST_SELLERS_CATEGORY_MAX_LENGTH,
  BEST_SELLERS_CATEGORY_REGEX,
  BEST_SELLERS_LIST_TYPE_ORDER,
  BEST_SELLERS_MAX_PAGE,
  BEST_SELLERS_ROOT_CATEGORY,
  BestSellersListType,
} from '@repo/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { BestSellersUrlState } from '../bestSellers.types';

const PARAM_LIST = 'list';
const PARAM_CATEGORY = 'category';
const PARAM_PAGE = 'page';

const DEFAULT_LIST_TYPE = BestSellersListType.BEST_SELLERS;
const DEFAULT_PAGE = 1;

function parseListType(raw: string | null): BestSellersListType {
  return BEST_SELLERS_LIST_TYPE_ORDER.includes(raw as BestSellersListType)
    ? (raw as BestSellersListType)
    : DEFAULT_LIST_TYPE;
}

/** Same grammar the API validates — an unparseable alias falls back to the root, never to a request that 400s. */
function parseCategory(raw: string | null): string {
  if (!raw) {
    return BEST_SELLERS_ROOT_CATEGORY;
  }
  return raw.length <= BEST_SELLERS_CATEGORY_MAX_LENGTH && BEST_SELLERS_CATEGORY_REGEX.test(raw)
    ? raw
    : BEST_SELLERS_ROOT_CATEGORY;
}

function parsePage(raw: string | null): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= DEFAULT_PAGE && value <= BEST_SELLERS_MAX_PAGE
    ? value
    : DEFAULT_PAGE;
}

export function useBestSellersUrlState(): BestSellersUrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  const listType = parseListType(searchParams.get(PARAM_LIST));
  const category = parseCategory(searchParams.get(PARAM_CATEGORY));
  const page = parsePage(searchParams.get(PARAM_PAGE));

  const setListType = useCallback(
    (value: BestSellersListType) => {
      const next = new URLSearchParams(searchParams);
      if (value === DEFAULT_LIST_TYPE) {
        next.delete(PARAM_LIST);
      } else {
        next.set(PARAM_LIST, value);
      }
      next.delete(PARAM_PAGE);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setCategory = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === BEST_SELLERS_ROOT_CATEGORY) {
        next.delete(PARAM_CATEGORY);
      } else {
        next.set(PARAM_CATEGORY, value);
      }
      next.delete(PARAM_PAGE);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setPage = useCallback(
    (value: number) => {
      const next = new URLSearchParams(searchParams);
      const clamped = Math.min(Math.max(DEFAULT_PAGE, Math.trunc(value)), BEST_SELLERS_MAX_PAGE);
      if (clamped === DEFAULT_PAGE) {
        next.delete(PARAM_PAGE);
      } else {
        next.set(PARAM_PAGE, String(clamped));
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return useMemo(
    () => ({ listType, category, page, setListType, setCategory, setPage }),
    [listType, category, page, setListType, setCategory, setPage],
  );
}
