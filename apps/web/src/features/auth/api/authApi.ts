/**
 * Auth API - RTK Query Endpoints
 *
 * Provides authentication endpoints:
 * - register: Create new user account
 * - login: Authenticate user
 * - getMe: Get current user information
 */

import { baseApi } from '@/api/baseApi';
import type { AuthResponse, LoginRequest, RegisterRequest, UserDto } from '@repo/shared';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Register new user
     */
    register: builder.mutation<AuthResponse, RegisterRequest>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Login user
     */
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Get current user information
     */
    getMe: builder.query<UserDto, void>({
      query: () => ({
        url: '/auth/me',
        method: 'GET',
      }),
      providesTags: ['Auth'],
    }),
  }),
});

export const { useRegisterMutation, useLoginMutation, useGetMeQuery, useLazyGetMeQuery } = authApi;
