import { baseApi } from '@/api/baseApi';
import type {
    CreateListingSettingsGroupRequest,
    ListingSettingsGroupResponse,
    PredefinedTemplateResponse,
    UpdateListingSettingsGroupRequest
} from '@repo/shared';

export const listingSettingsGroupApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getListingSettingsGroups: builder.query<ListingSettingsGroupResponse[], void>({
      query: () => '/listing-settings-group/groups',
      providesTags: ['ListingSettingsGroups'],
    }),

    getListingSettingsGroupById: builder.query<ListingSettingsGroupResponse, string>({
      query: (id) => `/listing-settings-group/groups/${id}`,
      providesTags: (result, error, id) => [{ type: 'ListingSettingsGroups', id }],
    }),

    createListingSettingsGroup: builder.mutation<ListingSettingsGroupResponse, CreateListingSettingsGroupRequest>({
      query: (data) => ({
        url: '/listing-settings-group/groups',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ListingSettingsGroups'],
    }),

    updateListingSettingsGroup: builder.mutation<ListingSettingsGroupResponse, { id: string; data: UpdateListingSettingsGroupRequest }>({
      query: ({ id, data }) => ({
        url: `/listing-settings-group/groups/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'ListingSettingsGroups', id }, 'ListingSettingsGroups'],
    }),

    deleteListingSettingsGroup: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/listing-settings-group/groups/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ListingSettingsGroups'],
    }),

    getPredefinedTemplates: builder.query<PredefinedTemplateResponse[], void>({
      query: () => '/listing-settings-group/predefined-templates',
      providesTags: ['PredefinedTemplates'],
    }),
  }),
});

export const {
  useGetListingSettingsGroupsQuery,
  useGetListingSettingsGroupByIdQuery,
  useCreateListingSettingsGroupMutation,
  useUpdateListingSettingsGroupMutation,
  useDeleteListingSettingsGroupMutation,
  useGetPredefinedTemplatesQuery,
} = listingSettingsGroupApi;
