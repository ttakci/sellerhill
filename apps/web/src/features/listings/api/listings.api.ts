import type {
  CreateListingsRequest,
  EbayBusinessPolicyDto,
  ListingDto,
  ListingJobDto,
  ListingJobItemDto,
  ListingJobsQueryDto,
  ListingsQueryDto,
  PaginatedListingJobsDto,
  PaginatedListingsDto,
  PaginatedProductsDto,
  UpdateListingRequest,
  UserProductsQueryDto,
} from '@repo/shared';

import { baseApi } from '../../../api/baseApi';

/** Build query-string params from ListingsQueryDto (omit empty). */
export function listingsQueryToParams(query: ListingsQueryDto = {}): Record<string, string> {
  const params: Record<string, string> = {};
  const set = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params[key] = String(value);
  };

  set('page', query.page);
  set('limit', query.limit);
  set('search', query.search);
  set('status', query.status);
  set('stockPreset', query.stockPreset);
  set('ebayAccountId', query.ebayAccountId);
  set('category', query.category);
  set('sortBy', query.sortBy);
  set('sortOrder', query.sortOrder);
  set('priceMin', query.priceMin);
  set('priceMax', query.priceMax);
  set('purchasePriceMin', query.purchasePriceMin);
  set('purchasePriceMax', query.purchasePriceMax);
  set('estimatedProfitMin', query.estimatedProfitMin);
  set('estimatedProfitMax', query.estimatedProfitMax);
  set('roiMin', query.roiMin);
  set('roiMax', query.roiMax);
  set('profitMarginMin', query.profitMarginMin);
  set('profitMarginMax', query.profitMarginMax);
  set('soldCountMin', query.soldCountMin);
  set('soldCountMax', query.soldCountMax);
  set('watchCountMin', query.watchCountMin);
  set('watchCountMax', query.watchCountMax);
  set('viewCountMin', query.viewCountMin);
  set('viewCountMax', query.viewCountMax);
  set('quantityMin', query.quantityMin);
  set('quantityMax', query.quantityMax);
  set('sourceStockMin', query.sourceStockMin);
  set('sourceStockMax', query.sourceStockMax);
  set('soldFrom', query.soldFrom);
  set('soldTo', query.soldTo);

  return params;
}

export const listingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Paginated listings — server-side filter/sort/page.
     * Always pass explicit page/limit for table UIs.
     */
    getListings: builder.query<PaginatedListingsDto, ListingsQueryDto | void>({
      query: (query) => {
        // Always send page/limit so Network tab + server pagination are explicit
        const q = query ?? {};
        return {
          url: '/listings',
          params: listingsQueryToParams({
            page: q.page ?? 1,
            limit: q.limit ?? 20,
            ...q,
          }),
        };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.items.map(({ id }) => ({ type: 'Listings' as const, id })),
              { type: 'Listings', id: 'LIST' },
            ]
          : [{ type: 'Listings', id: 'LIST' }],
    }),

    /**
     * Dedicated CSV export (server builds CSV; same filters as list, up to 5k rows).
     */
    exportListingsCsv: builder.mutation<string, ListingsQueryDto | void>({
      query: (query) => ({
        url: '/listings/export',
        method: 'GET',
        params: listingsQueryToParams(query ?? {}),
        responseHandler: (response) => response.text(),
      }),
    }),
    /**
     * Get all listing jobs for user
     */
    getListingJobs: builder.query<PaginatedListingJobsDto, ListingJobsQueryDto | void>({
      query: (params) => ({ url: '/listings/jobs', params: params ?? undefined }),
      providesTags: ['Listings'],
    }),
    /**
     * Get products behind the user's listings (server-paginated)
     */
    getUserProducts: builder.query<PaginatedProductsDto, UserProductsQueryDto | void>({
      query: (params) => ({ url: '/listings/products', params: params ?? undefined }),
      providesTags: ['Listings'],
    }),

    /**
     * Create bulk listings from ASINs
     */
    createListings: builder.mutation<ListingJobDto, CreateListingsRequest>({
      query: (data) => ({
        url: '/listings/bulk-create',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Listings'],
    }),

    /**
     * Get job status (with polling support)
     */
    getJobStatus: builder.query<ListingJobDto, string>({
      query: (jobId) => `/listings/jobs/${jobId}`,
      providesTags: (result, error, jobId) => [{ type: 'Listings', id: jobId }],
    }),

    /**
     * Get job items
     */
    getJobItems: builder.query<ListingJobItemDto[], string>({
      query: (jobId) => `/listings/jobs/${jobId}/items`,
      providesTags: (result, error, jobId) => [{ type: 'Listings', id: `${jobId}-items` }],
    }),

    /**
     * Re-queue a single failed ASIN (a failed create writes no listing row, so
     * this is the only way to retry one item without re-running the import).
     */
    retryJobItem: builder.mutation<{ success: boolean }, { jobId: string; itemId: string }>({
      query: ({ jobId, itemId }) => ({
        url: `/listings/jobs/${jobId}/items/${itemId}/retry`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { jobId }) => [
        { type: 'Listings', id: `${jobId}-items` },
        { type: 'Listings', id: jobId },
      ],
    }),

    /**
     * Get eBay business policies
     */
    getBusinessPolicies: builder.query<EbayBusinessPolicyDto[], void>({
      query: () => '/ebay/business-policies',
      providesTags: ['EbayPolicies'],
    }),

    /**
     * Single listing detail
     */
    getListingById: builder.query<ListingDto, string>({
      query: (id) => `/listings/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Listings', id }],
    }),

    /**
     * Update listing customizations (title, group, policies)
     */
    updateListing: builder.mutation<ListingDto, { id: string; data: UpdateListingRequest }>({
      query: ({ id, data }) => ({
        url: `/listings/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Listings', id },
        { type: 'Listings', id: 'LIST' },
      ],
    }),

    /**
     * End listings on eBay (withdraw offers)
     */
    endListings: builder.mutation<{ success: boolean; count: number }, string[]>({
      query: (listingIds) => ({
        url: '/listings/bulk-end',
        method: 'POST',
        body: { listingIds },
      }),
      invalidatesTags: ['Listings'],
    }),

    /**
     * Delete listings (withdraws them on eBay first)
     */
    deleteListings: builder.mutation<{ success: boolean; count: number }, string[]>({
      query: (listingIds) => ({
        url: '/listings/bulk-delete',
        method: 'POST',
        body: { listingIds },
      }),
      invalidatesTags: ['Listings'],
    }),

    /**
     * Publish a single draft listing to eBay
     */
    publishListing: builder.mutation<ListingDto, string>({
      query: (id) => ({
        url: `/listings/${id}/publish`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Listings', id },
        { type: 'Listings', id: 'LIST' },
      ],
    }),

    /**
     * Bulk publish draft listings
     */
    publishListings: builder.mutation<{ success: boolean; count: number }, string[]>({
      query: (listingIds) => ({
        url: '/listings/bulk-publish',
        method: 'POST',
        body: { listingIds },
      }),
      invalidatesTags: ['Listings'],
    }),
  }),
});

export const {
  useGetListingsQuery,
  useLazyGetListingsQuery,
  useGetListingByIdQuery,
  useUpdateListingMutation,
  useExportListingsCsvMutation,
  useGetListingJobsQuery,
  useGetUserProductsQuery,
  useCreateListingsMutation,
  useGetJobStatusQuery,
  useGetJobItemsQuery,
  useRetryJobItemMutation,
  useGetBusinessPoliciesQuery,
  useEndListingsMutation,
  useDeleteListingsMutation,
  usePublishListingMutation,
  usePublishListingsMutation,
} = listingsApi;

// Re-export type for consumers that still need ListingDto
export type { ListingDto, ListingsQueryDto, PaginatedListingsDto };
