import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { BlacklistAddDrawerComponent } from './BlacklistAddDrawer.component';
import type { BlacklistAddDrawerProps, BlacklistScope } from './BlacklistAddDrawer.types';

import { useGetAllStoreSettingsQuery, useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

export const BlacklistAddDrawer: React.FC<BlacklistAddDrawerProps> = ({
  isOpen,
  onClose,
  availableStores,
  storeConfigs,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();

  const { isLoading } = useGetAllStoreSettingsQuery(undefined, { skip: !isOpen });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isLoading || isSaving);

  const [selectedScope, setSelectedScope] = useState<string>(GLOBAL_SCOPE);
  const [keyword, setKeyword] = useState('');
  const [scopeValue, setScopeValue] = useState<BlacklistScope>('both');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scopeOptions = buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'));

  const handleAdd = (): void => {
    const trimmed = keyword.trim();
    if (trimmed.length === 0) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.empty'));
      return;
    }
    const config = resolveScopeConfig(storeConfigs, selectedScope);
    const existing = config?.blacklist ?? [];
    const isDuplicate = existing.some(
      (b) => b.keyword.toLowerCase() === trimmed.toLowerCase() && b.scope === scopeValue,
    );
    if (isDuplicate) {
      setErrorMessage(t('translation:settingsHub.drawer.blacklist.add.duplicate'));
      return;
    }
    setErrorMessage(null);

    const payload = {
      isGlobal: selectedScope === GLOBAL_SCOPE,
      storeId: selectedScope === GLOBAL_SCOPE ? undefined : selectedScope,
      country: config?.country ?? '',
      state: config?.state ?? '',
      zipCode: config?.zipCode ?? '',
      validateTitle: config?.validateTitle ?? true,
      validateDescription: config?.validateDescription ?? false,
      blacklist: [...existing, { keyword: trimmed, scope: scopeValue }].map((b) => ({
        keyword: b.keyword,
        scope: b.scope,
      })),
    };

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void saveSettings(payload)
      .unwrap()
      .then(() => {
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'translation:common.saveSuccess',
            primaryButton: { labelKey: 'translation:message.success.ok', onClick: closeMessage },
          },
          t,
        );
        setKeyword('');
        onClose();
      })
      .catch((error: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
  };

  return (
    <BlacklistAddDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      scopeOptions={scopeOptions}
      selectedScope={selectedScope}
      onSelectScope={setSelectedScope}
      keyword={keyword}
      onKeywordChange={(e) => setKeyword(e.target.value)}
      selectedScopeValue={scopeValue}
      onSelectScopeValue={setScopeValue}
      onAdd={handleAdd}
      isSaving={isSaving}
      errorMessage={errorMessage}
    />
  );
};

BlacklistAddDrawer.displayName = 'BlacklistAddDrawer';
