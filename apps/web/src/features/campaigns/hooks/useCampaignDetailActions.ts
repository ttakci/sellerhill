import { type CampaignAction, type CampaignListingDto, type EbayCampaignDetailDto } from '@repo/shared';
import { useToast } from '@repo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePerformCampaignActionMutation, useRemoveCampaignListingsMutation } from '../api/campaigns.api';
import { campaignErrorKey, writeOutcome } from '../CampaignDetailPage/CampaignMembers.helpers';

import { useCampaignRequestScope } from './useCampaignRequestScope';

export function useCampaignDetailActions(
  storeId: string | null,
  campaignId: string | undefined,
  detail: EbayCampaignDetailDto | undefined,
  writable: boolean
) {
  const { t } = useTranslation(['campaigns']);
  const { toast } = useToast();
  const request = useCampaignRequestScope(storeId, campaignId);
  const [remove] = useRemoveCampaignListingsMutation();
  const [action] = usePerformCampaignActionMutation();
  const [state, setState] = useState({
    context: `${storeId}:${campaignId}`,
    selected: [] as CampaignListingDto[],
    endOpen: false,
    busy: false,
    feedback: null as string | null,
  });
  const context = `${storeId}:${campaignId}`;
  if (state.context !== context) {
    setState({ context, selected: [], endOpen: false, busy: false, feedback: null });
  }
  const current =
    state.context === context ? state : { ...state, selected: [], endOpen: false, busy: false, feedback: null };
  const onRemove = async (members: CampaignListingDto[]) => {
    if (!request.isContextCurrent() || !storeId || !campaignId || !writable || current.busy || !members.length) {
      return;
    }
    const isCurrent = request.begin();
    setState((previous) => ({ ...previous, busy: true, feedback: null }));
    try {
      const result = await remove({
        ebayAccountId: storeId,
        campaignId,
        listingIds: members.map((member) => member.listingId),
      }).unwrap();
      if (!isCurrent()) {
        return;
      }
      const outcome = writeOutcome(
        members.map((member) => member.listingId),
        result
      );
      setState((previous) => ({
        ...previous,
        selected: members.filter((member) => outcome.failed.includes(member.listingId)),
        feedback: t('campaigns.results.summary', {
          changed: outcome.changed.length,
          already: outcome.already.length,
          failed: outcome.failed.length,
        }),
      }));
      if (outcome.changed.length && !outcome.failed.length) {
        toast.success(t('campaigns.members.removed'));
      }
    } catch (failure: unknown) {
      if (isCurrent()) {
        setState((previous) => ({ ...previous, selected: members, feedback: t(campaignErrorKey(failure)) }));
      }
    } finally {
      if (isCurrent()) {
        setState((previous) => ({ ...previous, busy: false }));
      }
    }
  };
  const onAction = async (operation: CampaignAction) => {
    if (!request.isContextCurrent() || !storeId || !campaignId || !writable || current.busy || !detail) {
      return;
    }
    const isCurrent = request.begin();
    setState((previous) => ({ ...previous, busy: true, feedback: null }));
    try {
      await action({ ebayAccountId: storeId, campaignId, action: operation }).unwrap();
      if (isCurrent()) {
        setState((previous) => ({ ...previous, endOpen: false }));
        toast.success(t('campaigns.lifecycle.success'));
      }
    } catch (failure: unknown) {
      if (isCurrent()) {
        setState((previous) => ({ ...previous, feedback: t(campaignErrorKey(failure)) }));
      }
    } finally {
      if (isCurrent()) {
        setState((previous) => ({ ...previous, busy: false }));
      }
    }
  };
  return {
    ...current,
    onSelect: (selected: CampaignListingDto[]) => setState((previous) => ({ ...previous, selected })),
    onRemove: (members: CampaignListingDto[]) => {
      void onRemove(members);
    },
    onAction: (operation: CampaignAction) => {
      void onAction(operation);
    },
    onEndOpen: () => setState((previous) => ({ ...previous, endOpen: true })),
    onEndClose: () => {
      request.cancel();
      setState((previous) => ({ ...previous, endOpen: false, busy: false, feedback: null }));
    },
  };
}
