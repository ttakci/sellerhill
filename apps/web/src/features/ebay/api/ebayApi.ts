/**
 * eBay API - RTK Query Endpoints
 *
 * Provides eBay integration endpoints:
 * - getConnectUrl: Generate OAuth consent URL
 * - getAccounts: Get connected eBay accounts
 */

import { baseApi } from '@/api/baseApi';
import type { CreateEbayConnectUrlResponse, EbayMarketplaceId, GetEbayAccountsResponse } from '@repo/shared';

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
  }),
});

export const { useLazyGetEbayConnectUrlQuery, useGetEbayAccountsQuery } = ebayApi;
