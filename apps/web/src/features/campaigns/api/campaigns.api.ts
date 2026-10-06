import {
  type CampaignCandidatesDto,
  type CampaignCandidatesQuery,
  type CampaignListingsRequest,
  type CampaignRateRequest,
  type CampaignWriteResultDto,
  type CreateCampaignRequest,
  type EbayCampaignDetailDto,
  type EbayCampaignDto,
  type EbayCampaignListDto,
  CampaignAction,
} from '@repo/shared';

import { baseApi } from '../../../api/baseApi';

type StoreArg = { ebayAccountId: string };
type CampaignArg = StoreArg & { campaignId: string };
type CampaignListingsArg = CampaignArg & Pick<CampaignListingsRequest, 'listingIds'>;
type CampaignRateArg = CampaignArg & Pick<CampaignRateRequest, 'bidPercentage' | 'listingIds'>;
type CampaignActionArg = CampaignArg & { action: CampaignAction };

const campaignTags = (ebayAccountId: string, campaignId?: string) => [
  { type: 'Campaigns' as const, id: ebayAccountId },
  ...(campaignId ? [{ type: 'Campaigns' as const, id: `${ebayAccountId}:${campaignId}` }] : []),
];

const writeTags = (_result: unknown, _error: unknown, arg: CampaignArg) => [
  ...campaignTags(arg.ebayAccountId, arg.campaignId),
  { type: 'Listings' as const, id: 'LIST' },
  'Listings' as const,
];

export const campaignsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCampaigns: builder.query<EbayCampaignListDto, StoreArg>({
      query: ({ ebayAccountId }) => ({ url: '/campaigns', params: { ebayAccountId } }),
      providesTags: (result, _error, { ebayAccountId }) => [
        ...campaignTags(ebayAccountId),
        ...(result?.campaigns ?? []).map(({ campaignId }) => ({
          type: 'Campaigns' as const,
          id: `${ebayAccountId}:${campaignId}`,
        })),
      ],
    }),
    getCampaign: builder.query<EbayCampaignDetailDto, CampaignArg>({
      query: ({ ebayAccountId, campaignId }) => ({
        url: `/campaigns/${campaignId}`,
        params: { ebayAccountId },
      }),
      providesTags: (_result, _error, { ebayAccountId, campaignId }) => campaignTags(ebayAccountId, campaignId),
    }),
    getCampaignCandidates: builder.query<CampaignCandidatesDto, CampaignCandidatesQuery>({
      query: ({ ebayAccountId, listingSettingsGroupId, search, page, limit }) => ({
        url: '/campaigns/candidates',
        params: { ebayAccountId, listingSettingsGroupId, search, page, limit },
      }),
      providesTags: (_result, _error, { ebayAccountId }) => [
        { type: 'Campaigns', id: ebayAccountId },
        { type: 'Listings', id: 'LIST' },
      ],
    }),
    createCampaign: builder.mutation<EbayCampaignDto, CreateCampaignRequest>({
      query: (body) => ({ url: '/campaigns', method: 'POST', body }),
      invalidatesTags: (_result, _error, { ebayAccountId }) => campaignTags(ebayAccountId),
    }),
    addCampaignListings: builder.mutation<CampaignWriteResultDto, CampaignListingsArg>({
      query: ({ campaignId, ...body }) => ({
        url: `/campaigns/${campaignId}/listings/add`, method: 'POST', body,
      }),
      invalidatesTags: writeTags,
    }),
    removeCampaignListings: builder.mutation<CampaignWriteResultDto, CampaignListingsArg>({
      query: ({ campaignId, ...body }) => ({
        url: `/campaigns/${campaignId}/listings/remove`, method: 'POST', body,
      }),
      invalidatesTags: writeTags,
    }),
    changeCampaignRate: builder.mutation<CampaignWriteResultDto, CampaignRateArg>({
      query: ({ campaignId, ...body }) => ({ url: `/campaigns/${campaignId}/rate`, method: 'POST', body }),
      invalidatesTags: writeTags,
    }),
    performCampaignAction: builder.mutation<EbayCampaignDto, CampaignActionArg>({
      query: ({ campaignId, action, ebayAccountId }) => ({
        url: `/campaigns/${campaignId}/actions/${action}`, method: 'POST', body: { ebayAccountId },
      }),
      invalidatesTags: writeTags,
    }),
  }),
});

export const {
  useGetCampaignsQuery,
  useGetCampaignQuery,
  useGetCampaignCandidatesQuery,
  useCreateCampaignMutation,
  useAddCampaignListingsMutation,
  useRemoveCampaignListingsMutation,
  useChangeCampaignRateMutation,
  usePerformCampaignActionMutation,
} = campaignsApi;
