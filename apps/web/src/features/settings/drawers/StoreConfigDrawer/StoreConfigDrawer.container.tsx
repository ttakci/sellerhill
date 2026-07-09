import type { SaveStoreSettingsRequest } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StoreConfigDrawerComponent } from './StoreConfigDrawer.component';
import type {
  StoreConfigDrawerProps,
  StoreConfigStoreOption,
} from './StoreConfigDrawer.types';

import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const GLOBAL_SCOPE = 'global';

export const StoreConfigDrawer: React.FC<StoreConfigDrawerProps> = ({
  isOpen,
  onClose,
  editingConfig,
  availableStores,
  existingConfigs,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const [saveSettings, { isLoading: isSaving }] = useSaveStoreSettingsMutation();

  const mode: 'create' | 'edit' = editingConfig ? 'edit' : 'create';

  // Form state is initialized from editingConfig on mount. The parent remounts
  // this component (via key) whenever the drawer reopens or the target changes,
  // so lazy initializers are sufficient — no syncing effect needed.
  const [selectedScope, setSelectedScope] = useState<string>(
    editingConfig
      ? editingConfig.isGlobal
        ? GLOBAL_SCOPE
        : editingConfig.storeId ?? ''
      : GLOBAL_SCOPE,
  );
  const [country, setCountry] = useState(editingConfig?.country ?? '');
  const [stateField, setStateField] = useState(editingConfig?.state ?? '');
  const [zipCode, setZipCode] = useState(editingConfig?.zipCode ?? '');
  const [validateTitle, setValidateTitle] = useState(editingConfig?.validateTitle ?? true);
  const [validateDescription, setValidateDescription] = useState(
    editingConfig?.validateDescription ?? false,
  );

  // Stores that already have a config — excluded from create-mode targets.
  const configuredStoreIds = useMemo(
    () =>
      new Set(
        existingConfigs
          .filter((c) => !c.isGlobal && c.storeId)
          .map((c) => c.storeId as string),
      ),
    [existingConfigs],
  );

  const hasGlobalConfig = useMemo(
    () => existingConfigs.some((c) => c.isGlobal),
    [existingConfigs],
  );

  // Create-mode target options: global (if none yet) + unconfigured stores.
  const scopeOptions: StoreConfigStoreOption[] = useMemo(() => {
    if (mode === 'edit') {
      return [];
    }
    const options: StoreConfigStoreOption[] = [];
    if (!hasGlobalConfig) {
      options.push({ id: GLOBAL_SCOPE, name: t('translation:settingsHub.drawer.storeConfig.global') });
    }
    availableStores.forEach((s) => {
      if (!configuredStoreIds.has(s.id)) {
        options.push(s);
      }
    });
    return options;
  }, [mode, hasGlobalConfig, configuredStoreIds, availableStores, t]);

  // Read-only label for the scope in edit mode.
  const scopeLabel = useMemo(() => {
    if (!editingConfig) {
      return '';
    }
    if (editingConfig.isGlobal) {
      return t('translation:settingsHub.drawer.storeConfig.global');
    }
    const match = availableStores.find((s) => s.id === editingConfig.storeId);
    return match?.name ?? editingConfig.storeId ?? '';
  }, [editingConfig, availableStores, t]);

  const isSaveDisabled =
    isSaving ||
    country.trim().length === 0 ||
    stateField.trim().length === 0 ||
    zipCode.trim().length === 0 ||
    // In create mode, disable if no selectable target remains.
    (mode === 'create' && scopeOptions.length === 0);

  const handleSave = (): void => {
    if (isSaveDisabled) {
      return;
    }
    const isGlobal = selectedScope === GLOBAL_SCOPE;
    // Preserve existing blacklist on edit (this drawer doesn't manage it).
    const blacklist = editingConfig?.blacklist ?? [];

    const payload: SaveStoreSettingsRequest = {
      isGlobal,
      storeId: isGlobal ? undefined : selectedScope,
      country: country.trim(),
      state: stateField.trim(),
      zipCode: zipCode.trim(),
      validateTitle,
      validateDescription,
      blacklist: blacklist.map((b) => ({ keyword: b.keyword, scope: b.scope })),
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
            primaryButton: {
              labelKey: 'translation:message.success.ok',
              onClick: closeMessage,
            },
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
    <StoreConfigDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      mode={mode}
      scopeLabel={scopeLabel}
      isScopeReadonly={mode === 'edit'}
      scopeOptions={scopeOptions}
      selectedScope={selectedScope}
      onSelectScope={setSelectedScope}
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

StoreConfigDrawer.displayName = 'StoreConfigDrawer';
