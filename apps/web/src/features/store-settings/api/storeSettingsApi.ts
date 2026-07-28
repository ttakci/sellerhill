import {
    BuyerMessagingConfig,
    SaveStoreSettingsRequest,
    StoreSettingsResponse
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const storeSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStoreSettings: builder.query<StoreSettingsResponse, { storeId?: string }>({
      query: ({ storeId }) => ({
        url: '/store-settings',
        params: { storeId },
      }),
      providesTags: ['StoreSettings'],
    }),
    getAllStoreSettings: builder.query<StoreSettingsResponse[], void>({
      query: () => ({
        url: '/store-settings/all',
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'StoreSettings' as const, id })),
              { type: 'StoreSettings', id: 'LIST' },
            ]
          : [{ type: 'StoreSettings', id: 'LIST' }],
    }),
    saveStoreSettings: builder.mutation<StoreSettingsResponse, SaveStoreSettingsRequest>({
      query: (body) => ({
        url: '/store-settings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['StoreSettings'],
    }),
    getBuyerMessagingConfig: builder.query<BuyerMessagingConfig | null, { storeId?: string } | void>({
      query: (args) => ({
        url: '/store-settings/buyer-messaging',
        params: args?.storeId ? { storeId: args.storeId } : undefined,
      }),
      providesTags: ['BuyerMessagingConfig'],
    }),
    updateBuyerMessagingConfig: builder.mutation<BuyerMessagingConfig, { config: BuyerMessagingConfig; storeId?: string }>({
      query: ({ config, storeId }) => ({
        url: '/store-settings/buyer-messaging',
        method: 'PUT',
        body: config,
        params: storeId ? { storeId } : undefined,
      }),
      invalidatesTags: ['BuyerMessagingConfig'],
    }),
  }),
});

export const {
    useGetStoreSettingsQuery,
    useGetAllStoreSettingsQuery,
    useSaveStoreSettingsMutation,
    useGetBuyerMessagingConfigQuery,
    useUpdateBuyerMessagingConfigMutation
} = storeSettingsApi;
