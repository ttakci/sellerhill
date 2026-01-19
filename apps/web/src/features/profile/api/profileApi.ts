import { baseApi } from '@/api/baseApi';
import type { ProfileDto, UpdateProfileRequest } from '@repo/shared';

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<ProfileDto, void>({
      query: () => ({
        url: '/profile',
        method: 'GET',
      }),
      providesTags: ['Profile'],
    }),
    updateProfile: builder.mutation<ProfileDto, UpdateProfileRequest>({
      query: (body) => ({
        url: '/profile',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Profile', 'Auth'],
    }),
  }),
});

export const { useGetProfileQuery, useUpdateProfileMutation } = profileApi;
