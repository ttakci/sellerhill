import type { AdminOperationsSummaryDto, AdminOverviewDto, QueueHealthDto, UsageSummaryDto } from '@repo/shared';

import { baseApi } from '@/api/baseApi';

export const adminAssistantApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminAssistantOverview: builder.query<AdminOverviewDto, void>({ query: () => '/admin/overview', providesTags: ['Admin'] }),
    getAdminAssistantOperations: builder.query<AdminOperationsSummaryDto, void>({ query: () => '/admin/queues/observations', providesTags: ['Admin'] }),
    getAdminAssistantQueues: builder.query<QueueHealthDto[], void>({ query: () => '/admin/queues/health', providesTags: ['Admin'] }),
    getAdminAssistantUsage: builder.query<UsageSummaryDto[], void>({ query: () => '/admin/usage/summaries', providesTags: ['Admin'] }),
    getKnowledgeStatus: builder.query<unknown, void>({ query: () => '/admin/knowledge/status', providesTags: ['Admin'] }),
    validateKnowledge: builder.mutation<unknown, string>({ query: (root) => ({ url: '/admin/knowledge/validate', method: 'POST', body: { root } }), invalidatesTags: ['Admin'] }),
    dryRunKnowledge: builder.mutation<unknown, string>({ query: (root) => ({ url: '/admin/knowledge/dry-run', method: 'POST', body: { root } }), invalidatesTags: ['Admin'] }),
    ingestKnowledge: builder.mutation<unknown, string>({ query: (root) => ({ url: '/admin/knowledge/ingest', method: 'POST', body: { root } }), invalidatesTags: ['Admin'] }),
    publishKnowledge: builder.mutation<unknown, string>({ query: (releaseId) => ({ url: `/admin/knowledge/publish/${releaseId}`, method: 'POST' }), invalidatesTags: ['Admin'] }),
    rollbackKnowledge: builder.mutation<unknown, string>({ query: (releaseId) => ({ url: `/admin/knowledge/rollback/${releaseId}`, method: 'POST' }), invalidatesTags: ['Admin'] }),
  }),
});

export const { useGetAdminAssistantOperationsQuery, useGetAdminAssistantOverviewQuery, useGetAdminAssistantQueuesQuery, useGetAdminAssistantUsageQuery, useGetKnowledgeStatusQuery } = adminAssistantApi;
