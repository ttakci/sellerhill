/**
 * eBay API - RTK Query Endpoints
 *
 * Provides eBay integration endpoints:
 * - getConnectUrl: Generate OAuth consent URL
 * - getAccounts: Get connected eBay accounts
 */

import type { CreateEbayConnectUrlResponse, EbayMarketplaceId, GetEbayAccountsResponse } from '@repo/shared';

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
  }),
});

export const { useLazyGetEbayConnectUrlQuery, useGetEbayAccountsQuery, useDisconnectEbayAccountMutation } = ebayApi;
