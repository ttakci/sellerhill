import { CAMPAIGN_BULK_MAX, isValidBidPercentage, type CampaignWriteResultDto } from '@repo/shared';
import { useToast } from '@repo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useChangeCampaignRateMutation } from '../../api/campaigns.api';
import { campaignErrorKey, writeOutcome } from '../../CampaignDetailPage/CampaignMembers.helpers';
import { useCampaignRequestScope } from '../../hooks/useCampaignRequestScope';

import { EditCampaignRateDrawerComponent } from './EditCampaignRateDrawer.component';
import type { EditCampaignRateDrawerProps } from './EditCampaignRateDrawer.types';

export function EditCampaignRateDrawerContainer({
  storeId,
  campaignId,
  members,
  listingId,
  initialRate,
  writable,
  onClose,
}: EditCampaignRateDrawerProps) {
  const { t } = useTranslation(['campaigns']);
  const { toast } = useToast();
  const request = useCampaignRequestScope(storeId, campaignId);
  const [changeRate] = useChangeCampaignRateMutation();
  const [rate, setRate] = useState(initialRate === null ? '' : String(initialRate));
  const [attempted, setAttempted] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const normalized = rate.trim().replace(',', '.');
  const valid = /^\d+(?:\.\d)?$/.test(normalized) && isValidBidPercentage(Number(normalized));
  const onSubmit = async () => {
    setAttempted(true);
    if (!request.isContextCurrent() || !valid || !writable || isSaving) {
      return;
    }
    const isCurrent = request.begin();
    const ids = retryIds ?? (listingId ? [listingId] : undefined);
    const expected = ids ?? members.map((member) => member.listingId);
    const results: CampaignWriteResultDto['results'] = [];
    let failure: unknown = null;
    setSaving(true);
    setFeedback(null);
    try {
      for (let i = 0; i < (ids?.length ?? 1) && failure === null; i += CAMPAIGN_BULK_MAX) {
        try {
          const result = await changeRate({
            ebayAccountId: storeId,
            campaignId,
            bidPercentage: Number(normalized),
            ...(ids ? { listingIds: ids.slice(i, i + CAMPAIGN_BULK_MAX) } : {}),
          }).unwrap();
          results.push(...result.results);
        } catch (error: unknown) {
          failure = error;
        }
        if (!isCurrent()) {
          return;
        }
      }
      const outcome = writeOutcome(expected, { results });
      if (failure !== null) {
        if (ids && results.length) {
          setRetryIds(outcome.failed);
        }
        setFeedback(t(campaignErrorKey(failure)));
        return;
      }
      setFeedback(
        t(outcome.unconfirmed && ids ? 'campaigns.results.unconfirmed' : 'campaigns.results.summary', {
          changed: outcome.changed.length,
          already: outcome.already.length,
          failed: outcome.failed.length,
        })
      );
      if (outcome.failed.length) {
        setRetryIds(outcome.failed);
      } else if (!ids || (!outcome.unconfirmed && outcome.changed.length)) {
        toast.success(t('campaigns.rate.success'));
        onClose();
      }
    } finally {
      if (isCurrent()) {
        setSaving(false);
      }
    }
  };
  return (
    <EditCampaignRateDrawerComponent
      isDefault={!listingId}
      isRetry={retryIds !== null}
      rate={rate}
      rateError={attempted && !valid ? t('campaigns.errors.invalidRate') : undefined}
      feedback={feedback}
      failedMembers={members.filter((member) => retryIds?.includes(member.listingId))}
      isSaving={isSaving}
      writable={writable}
      onRateChange={(event) => setRate(event.target.value)}
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
