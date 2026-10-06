import { CAMPAIGN_NAME_MAX_LENGTH, isValidBidPercentage } from '@repo/shared';
import { useToast } from '@repo/ui';
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateCampaignMutation } from '../../api/campaigns.api';

import { CreateCampaignDrawerComponent } from './CreateCampaignDrawer.component';
import type { CreateCampaignDrawerProps } from './CreateCampaignDrawer.types';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';

const ERROR_KEYS = [
  'storeUnavailable',
  'suspended',
  'notFound',
  'ineligible',
  'readOnly',
  'invalidRate',
  'ebayRejected',
  'invalidName',
  'nameTaken',
];

export function CreateCampaignDrawerContainer({ storeId, onClose }: CreateCampaignDrawerProps) {
  const { activeStoreId } = useActiveStore();
  const { t } = useTranslation(['campaigns']);
  const { toast } = useToast();
  const [createCampaign] = useCreateCampaignMutation();
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const live = useRef(false);
  const request = useRef(0);
  const currentStore = useRef(activeStoreId);
  currentStore.current = activeStoreId;
  useLayoutEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current += 1;
    };
  }, []);
  const validName = name.trim().length > 0 && name.trim().length <= CAMPAIGN_NAME_MAX_LENGTH;
  const normalizedRate = rate.trim().replace(',', '.');
  const validRate = /^\d+(?:\.\d)?$/.test(normalizedRate) && isValidBidPercentage(Number(normalizedRate));
  const onSubmit = async () => {
    setSubmitAttempted(true);
    if (!validName || !validRate || isSaving || currentStore.current !== storeId) {
      return;
    }
    const token = ++request.current;
    const isCurrent = () => live.current && request.current === token && currentStore.current === storeId;
    setError(null);
    setIsSaving(true);
    try {
      await createCampaign({
        ebayAccountId: storeId,
        name: name.trim(),
        bidPercentage: Number(normalizedRate),
      }).unwrap();
      if (!isCurrent()) {
        return;
      }
      toast.success(t('campaigns.create.success'));
      onClose();
    } catch (failure: unknown) {
      if (!isCurrent()) {
        return;
      }
      const data = typeof failure === 'object' && failure !== null && 'data' in failure ? failure.data : null;
      const message = typeof data === 'object' && data !== null && 'message' in data ? data.message : null;
      const key =
        typeof message === 'string' && ERROR_KEYS.some((suffix) => message === `campaigns.errors.${suffix}`)
          ? message
          : 'campaigns.errors.ebayRejected';
      setError(t(key));
    } finally {
      if (isCurrent()) {
        setIsSaving(false);
      }
    }
  };
  return (
    <CreateCampaignDrawerComponent
      name={name}
      rate={rate}
      nameError={submitAttempted && !validName ? t('campaigns.errors.invalidName') : undefined}
      rateError={submitAttempted && !validRate ? t('campaigns.errors.invalidRate') : undefined}
      error={error}
      isSaving={isSaving}
      onNameChange={(event) => setName(event.target.value)}
      onRateChange={(event) => setRate(event.target.value)}
      onSubmit={() => void onSubmit()}
      onClose={onClose}
    />
  );
}
