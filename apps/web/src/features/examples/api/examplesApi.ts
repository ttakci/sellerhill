import type {
  CreateExampleRequest,
  CreateExampleResponse,
  DeleteExampleRequest,
  DeleteExampleResponse,
  GetExamplesRequest,
  GetExamplesResponse,
  UpdateExampleRequest,
  UpdateExampleResponse,
} from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const examplesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExamples: builder.query<GetExamplesResponse, GetExamplesRequest>({
      query: (request) => ({
        url: '/examples',
        method: 'GET',
        params: request,
      }),
      providesTags: ['Example'],
    }),

    createExample: builder.mutation<CreateExampleResponse, CreateExampleRequest>({
      query: (request) => ({
        url: '/examples',
        method: 'POST',
        body: request,
      }),
      invalidatesTags: ['Example'],
    }),

    updateExample: builder.mutation<UpdateExampleResponse, { id: string; request: UpdateExampleRequest }>({
      query: ({ id, request }) => ({
        url: `/examples/${id}`,
        method: 'PATCH',
        body: request,
      }),
      invalidatesTags: ['Example'],
    }),

    deleteExample: builder.mutation<DeleteExampleResponse, DeleteExampleRequest>({
      query: ({ id }) => ({
        url: `/examples/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Example'],
    }),
  }),
});

export const { useGetExamplesQuery, useCreateExampleMutation, useUpdateExampleMutation, useDeleteExampleMutation } =
  examplesApi;
