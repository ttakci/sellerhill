import { Drawer, ModernTextInput, Select, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, FieldGrid, ToggleRow } from './StoreConfigDrawer.style';
import type { StoreConfigDrawerComponentProps } from './StoreConfigDrawer.types';

export const StoreConfigDrawerComponent: React.FC<StoreConfigDrawerComponentProps> = ({
  isOpen,
  onClose,
  mode,
  scopeLabel,
  isScopeReadonly,
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
  const { t } = useTranslation();

  const titleKey =
    mode === 'edit'
      ? 'translation:settingsHub.drawer.storeConfig.titleEdit'
      : 'translation:settingsHub.drawer.storeConfig.titleNew';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t(titleKey)}
      subtitle={t('translation:settingsHub.drawer.storeConfig.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: onSave,
        isLoading: isSaving,
        disabled: isSaveDisabled,
      }}
    >
      <BodyStack>
        {/* Scope: which store (or global) this config applies to */}
        {isScopeReadonly ? (
          <ModernTextInput
            label={t('translation:settingsHub.drawer.storeConfig.appliesTo')}
            value={scopeLabel}
            readOnly
          />
        ) : (
          <Select
            label={t('translation:settingsHub.drawer.storeConfig.appliesTo')}
            value={selectedScope}
            onChange={(value) => onSelectScope(String(value))}
            options={scopeOptions.map((o) => ({ label: o.name, value: o.id }))}
            fullWidth
          />
        )}

        {/* Location */}
        <ModernTextInput
          label={t('translation:settingsHub.sections.storeConfig.country')}
          value={country}
          onChange={onCountryChange}
        />
        <FieldGrid>
          <ModernTextInput
            label={t('translation:settingsHub.sections.storeConfig.region')}
            value={state}
            onChange={onStateChange}
          />
          <ModernTextInput
            label={t('translation:settingsHub.sections.storeConfig.zipCode')}
            value={zipCode}
            onChange={onZipCodeChange}
          />
        </FieldGrid>

        {/* Validation */}
        <Text variant="body-sm" weight="semibold">
          {t('translation:settingsHub.drawer.storeConfig.validation')}
        </Text>
        <ToggleRow>
          <Text variant="body-sm">
            {t('translation:settingsHub.drawer.storeConfig.validateTitle')}
          </Text>
          <Toggle checked={validateTitle} onChange={onToggleValidateTitle} />
        </ToggleRow>
        <ToggleRow>
          <Text variant="body-sm">
            {t('translation:settingsHub.drawer.storeConfig.validateDescription')}
          </Text>
          <Toggle checked={validateDescription} onChange={onToggleValidateDescription} />
        </ToggleRow>
      </BodyStack>
    </Drawer>
  );
};

StoreConfigDrawerComponent.displayName = 'StoreConfigDrawerComponent';
