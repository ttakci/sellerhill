import type {
    CreateListingsRequest,
    EbayBusinessPolicyDto,
    ListingDto,
    ListingJobDto,
    ListingJobItemDto,
} from '@repo/shared';
import { baseApi } from '../../../api/baseApi';

export const listingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get all listings for user
     */
    getListings: builder.query<ListingDto[], void>({
      query: () => '/listings',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Listings' as const, id })), { type: 'Listings', id: 'LIST' }]
          : [{ type: 'Listings', id: 'LIST' }],
    }),
    /**
     * Get all listing jobs for user
     */
    getListingJobs: builder.query<ListingJobDto[], void>({
      query: () => '/listings/jobs',
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
     * Get eBay business policies
     */
    getBusinessPolicies: builder.query<EbayBusinessPolicyDto[], void>({
      query: () => '/ebay/business-policies',
      providesTags: ['EbayPolicies'],
    }),
  }),
});

export const {
  useGetListingsQuery,
  useGetListingJobsQuery,
  useCreateListingsMutation,
  useGetJobStatusQuery,
  useGetJobItemsQuery,
  useGetBusinessPoliciesQuery,
} = listingsApi;
