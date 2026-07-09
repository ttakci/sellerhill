/**
 * Auth API - RTK Query Endpoints
 *
 * Provides authentication endpoints:
 * - register: Create new user account
 * - login: Authenticate user
 * - getMe: Get current user information
 */

import type { AuthResponse, ChangePasswordRequest, GenericSuccessResponse, LoginRequest, RegisterRequest, RegistrationResponse, UserDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Register new user
     */
    register: builder.mutation<RegistrationResponse, RegisterRequest>({
      query: (body) => ({
        url: '/auth/register',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Verify email address
     */
    verifyEmail: builder.mutation<AuthResponse, { token: string }>({
      query: (body) => ({
        url: '/auth/verify-email',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Resend verification email
     */
    resendVerification: builder.mutation<void, { email: string; locale?: string }>({
      query: (body) => ({
        url: '/auth/resend-verification',
        method: 'POST',
        body,
      }),
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

    /**
     * Change password for authenticated user
     */
    changePassword: builder.mutation<GenericSuccessResponse, ChangePasswordRequest>({
      query: (body) => ({
        url: '/auth/password',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Deactivate (soft-delete) the authenticated account
     */
    deactivateAccount: builder.mutation<GenericSuccessResponse, void>({
      query: () => ({
        url: '/auth/deactivate',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useGetMeQuery,
  useLazyGetMeQuery,
  useChangePasswordMutation,
  useDeactivateAccountMutation,
} = authApi;
