import { baseApi } from '@/api/baseApi';
import {
    SaveStoreSettingsRequest,
    StoreSettingsResponse
} from '@repo/shared';

export const storeSettingsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStoreSettings: builder.query<StoreSettingsResponse, { storeId?: string }>({
      query: ({ storeId }) => ({
        url: '/store-settings',
        params: { storeId },
      }),
      providesTags: ['StoreSettings'],
    }),
    saveStoreSettings: builder.mutation<StoreSettingsResponse, SaveStoreSettingsRequest>({
      query: (body) => ({
        url: '/store-settings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['StoreSettings'],
    }),
  }),
});

export const { 
    useGetStoreSettingsQuery, 
    useSaveStoreSettingsMutation 
} = storeSettingsApi;
