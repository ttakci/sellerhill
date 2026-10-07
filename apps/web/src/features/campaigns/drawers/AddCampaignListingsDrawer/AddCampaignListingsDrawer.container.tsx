import { CAMPAIGN_BULK_MAX, type CampaignWriteResultDto } from '@repo/shared';
import { useToast } from '@repo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAddCampaignListingsMutation } from '../../api/campaigns.api';
import { campaignErrorKey, writeOutcome } from '../../CampaignDetailPage/CampaignMembers.helpers';
import { useCampaignCandidates } from '../../hooks/useCampaignCandidates';
import { useCampaignRequestScope } from '../../hooks/useCampaignRequestScope';

import { AddCampaignListingsDrawerComponent } from './AddCampaignListingsDrawer.component';
import type { AddCampaignListingsDrawerProps } from './AddCampaignListingsDrawer.types';

import { useGetListingSettingsGroupsQuery } from '@/features/listing-settings-groups/api/listing-settings-group.api';

export function AddCampaignListingsDrawerContainer({
  storeId,
  campaignId,
  writable,
  onClose,
}: AddCampaignListingsDrawerProps) {
  const { t } = useTranslation(['campaigns']);
  const { toast } = useToast();
  const request = useCampaignRequestScope(storeId, campaignId);
  const candidates = useCampaignCandidates(storeId, campaignId, writable);
  const groups = useGetListingSettingsGroupsQuery(undefined, { skip: !writable });
  const [add] = useAddCampaignListingsMutation();
  const [isSaving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const onSubmit = async () => {
    setAttempted(true);
    if (!request.isContextCurrent() || !writable || isSaving || candidates.filling || !candidates.selected.length) {
      return;
    }
    const isCurrent = request.begin();
    const selected = candidates.selected;
    const ids = selected.map((member) => member.listingId);
    const results: CampaignWriteResultDto['results'] = [];
    let failure: unknown = null;
    setSaving(true);
    setFeedback(null);
    try {
      for (let i = 0; i < ids.length && failure === null; i += CAMPAIGN_BULK_MAX) {
        try {
          results.push(
            ...(
              await add({
                ebayAccountId: storeId,
                campaignId,
                listingIds: ids.slice(i, i + CAMPAIGN_BULK_MAX),
              }).unwrap()
            ).results
          );
        } catch (error: unknown) {
          failure = error;
        }
        if (!isCurrent()) {
          return;
        }
      }
      const outcome = writeOutcome(ids, { results });
      if (results.length) {
        candidates.onAdded(selected.filter((member) => outcome.failed.includes(member.listingId)));
        setAttempted(false);
      }
      if (failure !== null) {
        setFeedback(t(campaignErrorKey(failure)));
        return;
      }
      setFeedback(
        t('campaigns.results.summary', {
          changed: outcome.changed.length,
          already: outcome.already.length,
          failed: outcome.failed.length,
        })
      );
      if (outcome.changed.length && !outcome.failed.length) {
        toast.success(t('campaigns.add.success'));
        onClose();
      }
    } finally {
      if (isCurrent()) {
        setSaving(false);
      }
    }
  };
  return (
    <AddCampaignListingsDrawerComponent
      options={[
        { value: '', label: t('campaigns.add.allGroups') },
        ...(groups.currentData ?? []).map((group) => ({ value: group.id, label: group.name })),
      ]}
      group={candidates.group}
      groupError={candidates.groupError}
      groupsError={Boolean(groups.error)}
      filling={candidates.filling}
      search={candidates.search}
      items={(candidates.query.currentData?.items ?? []).map((member) => ({
        member,
        checked: candidates.selected.some((row) => row.listingId === member.listingId),
      }))}
      selected={candidates.selected}
      skipped={candidates.skipped}
      pageLabel={t('campaigns.add.page', { page: candidates.page + 1, total: candidates.pageCount })}
      previousDisabled={candidates.page === 0 || isSaving}
      nextDisabled={candidates.page + 1 >= candidates.pageCount || isSaving || candidates.query.isFetching}
      isLoading={!candidates.query.currentData && !candidates.query.error}
      candidatesError={Boolean(candidates.query.error)}
      isSaving={isSaving}
      writable={writable}
      feedback={feedback}
      selectionError={attempted && !candidates.selected.length ? t('campaigns.add.selectRequired') : undefined}
      onGroup={candidates.onGroup}
      onSearch={(event) => candidates.onSearch(event.target.value)}
      onToggle={candidates.onToggle}
      onPrevious={() => candidates.onPage(candidates.page - 1)}
      onNext={() => candidates.onPage(candidates.page + 1)}
      onRetryCandidates={() => {
        void candidates.query.refetch();
      }}
      onRetryGroup={candidates.onRetryGroup}
      onRetryGroups={() => {
        void groups.refetch();
      }}
      onSubmit={() => {
        void onSubmit();
      }}
      onClose={() => {
        if (!isSaving) {
          onClose();
        }
      }}
    />
  );
}
