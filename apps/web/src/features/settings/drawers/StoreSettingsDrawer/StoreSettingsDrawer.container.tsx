import { TrackingConversionProvider } from '@repo/shared';
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
  selectedScope,
  onSelectScope,
  onManageBlacklist,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();
  useLoading(isSaving);

  const config = resolveScopeConfig(storeConfigs, selectedScope);

  const [country, setCountry] = useState(config?.country ?? '');
  const [stateField, setStateField] = useState(config?.state ?? '');
  const [zipCode, setZipCode] = useState(config?.zipCode ?? '');
  const [validateTitle, setValidateTitle] = useState(config?.validateTitle ?? true);
  const [validateDescription, setValidateDescription] = useState(config?.validateDescription ?? false);
  const [amazonTaxRate, setAmazonTaxRate] = useState<number>(config?.amazonTaxRate ?? 0);
  const [autoFulfillEnabled, setAutoFulfillEnabled] = useState<boolean>(config?.autoFulfillEnabled ?? false);
  const [trackingConversionProvider, setTrackingConversionProvider] = useState<TrackingConversionProvider>(
    config?.trackingConversionProvider ?? TrackingConversionProvider.LOCAL,
  );

  // Reload fields when the drawer opens or the (hoisted) scope changes.
  // React-recommended render-time state adjustment.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevScope, setPrevScope] = useState(selectedScope);
  if (isOpen !== prevOpen || selectedScope !== prevScope) {
    setPrevOpen(isOpen);
    setPrevScope(selectedScope);
    if (isOpen) {
      const next = resolveScopeConfig(storeConfigs, selectedScope);
      setCountry(next?.country ?? '');
      setStateField(next?.state ?? '');
      setZipCode(next?.zipCode ?? '');
      setValidateTitle(next?.validateTitle ?? true);
      setValidateDescription(next?.validateDescription ?? false);
      setAmazonTaxRate(next?.amazonTaxRate ?? 0);
      setAutoFulfillEnabled(next?.autoFulfillEnabled ?? false);
      setTrackingConversionProvider(next?.trackingConversionProvider ?? TrackingConversionProvider.LOCAL);
    }
  }

  const scopeOptions = buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'));
  const isContinueDisabled =
    isSaving || country.trim().length === 0 || stateField.trim().length === 0 || zipCode.trim().length === 0;

  // "Continue" commits step 1 (location + validation) for the selected scope,
  // then advances to the blacklist step. Saving here is what carries the user's
  // location edits forward — the next step reads fresh config from the cache.
  const handleContinue = (): void => {
    if (isContinueDisabled) {
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
      amazonTaxRate,
      autoFulfillEnabled,
      trackingConversionProvider,
    };

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void saveSettings(payload)
      .unwrap()
      .then(() => {
        onManageBlacklist();
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
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
      onSelectScope={onSelectScope}
      country={country}
      state={stateField}
      zipCode={zipCode}
      validateTitle={validateTitle}
      validateDescription={validateDescription}
      amazonTaxRate={amazonTaxRate}
      autoFulfillEnabled={autoFulfillEnabled}
      trackingConversionProvider={trackingConversionProvider}
      onCountryChange={(e) => setCountry(e.target.value)}
      onStateChange={(e) => setStateField(e.target.value)}
      onZipCodeChange={(e) => setZipCode(e.target.value)}
      onToggleValidateTitle={setValidateTitle}
      onToggleValidateDescription={setValidateDescription}
      onAmazonTaxRateChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          setAmazonTaxRate(0);
          return;
        }
        const parsed = Number(raw);
        setAmazonTaxRate(Number.isFinite(parsed) ? parsed : 0);
      }}
      onAutoFulfillEnabledChange={setAutoFulfillEnabled}
      onTrackingConversionProviderChange={setTrackingConversionProvider}
      onContinue={handleContinue}
      isSaving={isSaving}
      isContinueDisabled={isContinueDisabled}
    />
  );
};

StoreSettingsDrawer.displayName = 'StoreSettingsDrawer';
