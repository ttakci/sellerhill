/**
 * Best Sellers API — RTK Query endpoints.
 *
 * `GET /best-sellers?listType=&category=&page=` answers from a shared per-list
 * cache on the API side; a miss spends one unit of the seller's daily
 * allowance, which is why the browser also keeps a fetched page around for a
 * while — flipping between two tabs must not re-request a list already shown.
 */

import type { BestSellersPageDto, BestSellersQueryDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

/** How long an unused list page stays in the RTK Query cache (seconds). */
export const BEST_SELLERS_KEEP_UNUSED_SECONDS = 300;

export const bestSellersApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBestSellers: builder.query<BestSellersPageDto, BestSellersQueryDto>({
      query: (params) => ({ url: '/best-sellers', method: 'GET', params }),
      providesTags: ['BestSellers'],
      keepUnusedDataFor: BEST_SELLERS_KEEP_UNUSED_SECONDS,
    }),
  }),
});

export const { useGetBestSellersQuery } = bestSellersApi;
