/**
 * eBay API - RTK Query Endpoints
 *
 * Provides eBay integration endpoints:
 * - getConnectUrl: Generate OAuth consent URL
 * - getAccounts: Get connected eBay accounts
 */

import type {
  CreateEbayConnectUrlResponse,
  EbayAdvertisingEligibilityDto,
  EbayMarketplaceId,
  GetEbayAccountsResponse,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const ebayApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Get eBay OAuth consent URL
     */
    getEbayConnectUrl: builder.query<CreateEbayConnectUrlResponse, { marketplaceId?: EbayMarketplaceId }>({
      query: ({ marketplaceId }) => ({
        url: '/ebay/connect-url',
        method: 'GET',
        params: marketplaceId ? { marketplaceId } : undefined,
      }),
    }),

    /**
     * Get connected eBay accounts
     */
    getEbayAccounts: builder.query<GetEbayAccountsResponse, void>({
      query: () => ({
        url: '/ebay/accounts',
        method: 'GET',
      }),
      providesTags: ['Ebay'],
    }),

    /**
     * Disconnect a connected eBay store. The store's order and listing
     * history is kept; reconnecting the same store later restores it.
     */
    disconnectEbayAccount: builder.mutation<{ success: true }, { accountId: string }>({
      query: ({ accountId }) => ({
        url: `/ebay/accounts/${accountId}/disconnect`,
        method: 'POST',
      }),
      invalidatesTags: ['Ebay'],
    }),

    /**
     * eBay's own answer to whether a store may use Promoted Listings. Both
     * fields are null when eBay could not be asked.
     */
    getEbayAdvertisingEligibility: builder.query<EbayAdvertisingEligibilityDto, string>({
      query: (accountId) => ({
        url: `/ebay/accounts/${accountId}/advertising-eligibility`,
        method: 'GET',
      }),
    }),
  }),
});

export const {
  useLazyGetEbayConnectUrlQuery,
  useGetEbayAccountsQuery,
  useDisconnectEbayAccountMutation,
  useGetEbayAdvertisingEligibilityQuery,
} = ebayApi;
