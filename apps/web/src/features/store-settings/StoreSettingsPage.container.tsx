import { getErrorMessage } from '@/utils/errorHandler';
import { type StoreSettingsFormData } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetEbayAccountsQuery } from '../../features/ebay/api/ebayApi';
import { StoreSettingsPageComponent } from './StoreSettingsPage.component';
import * as S from './StoreSettingsPage.style';
import {
    useGetStoreSettingsQuery,
    useSaveStoreSettingsMutation
} from './api/storeSettingsApi';

export const StoreSettingsPageContainer = (): React.ReactElement => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>(undefined);

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useGetStoreSettingsQuery({ storeId: selectedStoreId });
  
  // Fetch eBay accounts for store selection
  const { data: ebayAccounts } = useGetEbayAccountsQuery();
  
  // Save mutation
  const [saveSettings, { isLoading: isSaving, isSuccess: saveSuccess, error: saveError }] = useSaveStoreSettingsMutation();

  // Use RTK Query loading state with useLoading hook
  useLoading(settingsLoading || isSaving);

  // Handle success
  useEffect(() => {
    if (saveSuccess) {
      showMessage({
        type: 'success',
        headerKey: 'message.success.header',
        descriptionKey: 'common.saveSuccess',
        primaryButton: {
          labelKey: 'message.success.ok',
          onClick: closeMessage,
        },
      }, t);
    }
  }, [saveSuccess, showMessage, closeMessage, t]);

  // Handle errors
  useEffect(() => {
    if (saveError) {
      const { key, params } = getErrorMessage(saveError);
      showMessage({
        type: 'error',
        headerKey: 'message.error.header',
        descriptionKey: key,
        descriptionParams: params,
        primaryButton: {
          labelKey: 'message.error.close',
          onClick: closeMessage,
        },
      }, t);
    }
  }, [saveError, showMessage, closeMessage, t]);

  const handleSave = (data: StoreSettingsFormData): void => {
    void saveSettings({
      ...data,
      storeId: data.isGlobal ? undefined : selectedStoreId,
    });
  };

  if (settingsLoading || !settings) {
    return <S.LoadingContainer>{t('common.loading')}</S.LoadingContainer>;
  }

  const availableStores = ebayAccounts?.items.map(acc => ({
    id: acc.id,
    name: acc.storeName || acc.sellerId,
  })) || [];

  return (
    <StoreSettingsPageComponent
      settings={settings}
      onSave={handleSave}
      onStoreChange={(id) => setSelectedStoreId(id)}
      availableStores={availableStores}
    />
  );
};

export default StoreSettingsPageContainer;
