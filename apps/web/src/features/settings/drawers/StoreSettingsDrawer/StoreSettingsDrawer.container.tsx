import { useLoading, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { StoreSettingsDrawerComponent } from './StoreSettingsDrawer.component';
import type { StoreSettingsDrawerProps } from './StoreSettingsDrawer.types';

import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

export const StoreSettingsDrawer: React.FC<StoreSettingsDrawerProps> = ({
  isOpen,
  onClose,
  availableStores,
  storeConfigs,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isSaving);

  const [selectedScope, setSelectedScope] = useState<string>(GLOBAL_SCOPE);
  const initial = resolveScopeConfig(storeConfigs, selectedScope);
  const [country, setCountry] = useState(initial?.country ?? '');
  const [stateField, setStateField] = useState(initial?.state ?? '');
  const [zipCode, setZipCode] = useState(initial?.zipCode ?? '');
  const [validateTitle, setValidateTitle] = useState(initial?.validateTitle ?? true);
  const [validateDescription, setValidateDescription] = useState(initial?.validateDescription ?? false);

  // Reload fields from the chosen scope's config when the user switches scope.
  const handleSelectScope = (value: string): void => {
    setSelectedScope(value);
    const next = resolveScopeConfig(storeConfigs, value);
    setCountry(next?.country ?? '');
    setStateField(next?.state ?? '');
    setZipCode(next?.zipCode ?? '');
    setValidateTitle(next?.validateTitle ?? true);
    setValidateDescription(next?.validateDescription ?? false);
  };

  const scopeOptions = buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'));
  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const isSaveDisabled =
    isSaving || country.trim().length === 0 || stateField.trim().length === 0 || zipCode.trim().length === 0;

  const handleSave = (): void => {
    if (isSaveDisabled) {
      return;
    }
    // Preserve the selected scope's existing blacklist (this drawer doesn't manage it).
    const blacklist = (config?.blacklist ?? []).map((b) => ({ keyword: b.keyword, scope: b.scope }));
    const isGlobal = selectedScope === GLOBAL_SCOPE;
    const payload = {
      isGlobal,
      storeId: isGlobal ? undefined : selectedScope,
      country: country.trim(),
      state: stateField.trim(),
      zipCode: zipCode.trim(),
      validateTitle,
      validateDescription,
      blacklist,
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
    <StoreSettingsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      scopeOptions={scopeOptions}
      selectedScope={selectedScope}
      onSelectScope={handleSelectScope}
      country={country}
      state={stateField}
      zipCode={zipCode}
      validateTitle={validateTitle}
      validateDescription={validateDescription}
      onCountryChange={(e) => setCountry(e.target.value)}
      onStateChange={(e) => setStateField(e.target.value)}
      onZipCodeChange={(e) => setZipCode(e.target.value)}
      onToggleValidateTitle={setValidateTitle}
      onToggleValidateDescription={setValidateDescription}
      onSave={handleSave}
      isSaving={isSaving}
      isSaveDisabled={isSaveDisabled}
    />
  );
};

StoreSettingsDrawer.displayName = 'StoreSettingsDrawer';
