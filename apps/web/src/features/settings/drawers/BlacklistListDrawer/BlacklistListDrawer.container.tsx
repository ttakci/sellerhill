import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { BlacklistListDrawerComponent } from './BlacklistListDrawer.component';
import type { BlacklistListDrawerProps, BlacklistScope } from './BlacklistListDrawer.types';

import { useSaveStoreSettingsMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

export const BlacklistListDrawer: React.FC<BlacklistListDrawerProps> = ({
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

  const scopeOptions = buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'));
  const config = resolveScopeConfig(storeConfigs, selectedScope);
  const items = useMemo(() => config?.blacklist ?? [], [config]);
  const emptyMessage = t('translation:settingsHub.drawer.blacklist.list.empty');

  const handleRemove = (keyword: string, scope: BlacklistScope): void => {
    if (!config) {
      return;
    }
    const next = config.blacklist.filter((b) => !(b.keyword === keyword && b.scope === scope));
    const payload = {
      isGlobal: config.isGlobal,
      storeId: config.isGlobal ? undefined : config.storeId,
      country: config.country,
      state: config.state,
      zipCode: config.zipCode,
      validateTitle: config.validateTitle,
      validateDescription: config.validateDescription,
      blacklist: next.map((b) => ({ keyword: b.keyword, scope: b.scope })),
    };

    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    void saveSettings(payload)
      .unwrap()
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
    <BlacklistListDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      scopeOptions={scopeOptions}
      selectedScope={selectedScope}
      onSelectScope={setSelectedScope}
      items={items}
      onRemove={handleRemove}
      emptyMessage={emptyMessage}
    />
  );
};

BlacklistListDrawer.displayName = 'BlacklistListDrawer';
