import { Drawer, ModernSelect, ModernTextInput, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, FieldGrid, ToggleRow } from './StoreSettingsDrawer.style';
import type { StoreSettingsDrawerComponentProps } from './StoreSettingsDrawer.types';

export const StoreSettingsDrawerComponent: React.FC<StoreSettingsDrawerComponentProps> = ({
  isOpen,
  onClose,
  scopeOptions,
  selectedScope,
  onSelectScope,
  country,
  state,
  zipCode,
  validateTitle,
  validateDescription,
  onCountryChange,
  onStateChange,
  onZipCodeChange,
  onToggleValidateTitle,
  onToggleValidateDescription,
  onSave,
  isSaving,
  isSaveDisabled,
}) => {
  const { t } = useTranslation(['translation']);
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.storeSettings.title')}
      subtitle={t('translation:settingsHub.drawer.storeSettings.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: onSave,
        isLoading: isSaving,
        disabled: isSaveDisabled,
      }}
    >
      <BodyStack>
        <ModernSelect
          label={t('translation:settingsHub.drawer.storeSettings.appliesTo')}
          options={scopeOptions}
          value={selectedScope}
          onChange={(v) => onSelectScope(String(v))}
          fullWidth
          searchPlaceholder={t('translation:common.search')}
          noResultsMessage={t('translation:common.noResults')}
        />
        <ModernTextInput
          name="country"
          label={t('translation:settingsHub.drawer.storeSettings.country')}
          value={country}
          onChange={onCountryChange}
        />
        <FieldGrid>
          <ModernTextInput
            name="region"
            label={t('translation:settingsHub.drawer.storeSettings.region')}
            value={state}
            onChange={onStateChange}
          />
          <ModernTextInput
            name="zipCode"
            label={t('translation:settingsHub.drawer.storeSettings.zipCode')}
            value={zipCode}
            onChange={onZipCodeChange}
          />
        </FieldGrid>
        <Text variant="body-sm" weight="semibold">
          {t('translation:settingsHub.drawer.storeSettings.validation')}
        </Text>
        <ToggleRow>
          <Text variant="body-sm">{t('translation:settingsHub.drawer.storeSettings.validateTitle')}</Text>
          <Toggle checked={validateTitle} onChange={onToggleValidateTitle} />
        </ToggleRow>
        <ToggleRow>
          <Text variant="body-sm">{t('translation:settingsHub.drawer.storeSettings.validateDescription')}</Text>
          <Toggle checked={validateDescription} onChange={onToggleValidateDescription} />
        </ToggleRow>
      </BodyStack>
    </Drawer>
  );
};

StoreSettingsDrawerComponent.displayName = 'StoreSettingsDrawerComponent';
