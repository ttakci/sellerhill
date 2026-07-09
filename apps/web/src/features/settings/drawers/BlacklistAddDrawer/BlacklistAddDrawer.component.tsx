import { Drawer, ModernSelect, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, FieldGrid } from './BlacklistAddDrawer.style';
import type { BlacklistAddDrawerComponentProps, BlacklistScope } from './BlacklistAddDrawer.types';

export const BlacklistAddDrawerComponent: React.FC<BlacklistAddDrawerComponentProps> = ({
  isOpen,
  onClose,
  scopeOptions,
  selectedScope,
  onSelectScope,
  keyword,
  onKeywordChange,
  selectedScopeValue,
  onSelectScopeValue,
  onAdd,
  isSaving,
  errorMessage,
}) => {
  const { t } = useTranslation(['translation']);
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.blacklist.add.title')}
      subtitle={t('translation:settingsHub.drawer.blacklist.add.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:settingsHub.drawer.blacklist.add.add'),
        onClick: onAdd,
        isLoading: isSaving,
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
        <FieldGrid>
          <ModernTextInput
            name="keyword"
            label={t('translation:settingsHub.drawer.blacklist.add.keyword')}
            value={keyword}
            onChange={onKeywordChange}
          />
          <ModernSelect
            label={t('translation:settingsHub.drawer.blacklist.add.scope')}
            options={[
              { value: 'both', label: t('translation:settingsHub.drawer.blacklist.add.scopeBoth') },
              { value: 'title', label: t('translation:settingsHub.drawer.blacklist.add.scopeTitle') },
              { value: 'description', label: t('translation:settingsHub.drawer.blacklist.add.scopeDescription') },
            ]}
            value={selectedScopeValue}
            onChange={(v) => onSelectScopeValue(v as BlacklistScope)}
            fullWidth
            searchPlaceholder={t('translation:common.search')}
            noResultsMessage={t('translation:common.noResults')}
          />
        </FieldGrid>
        {errorMessage && (
          <Text variant="caption" color="semantic.error">
            {errorMessage}
          </Text>
        )}
      </BodyStack>
    </Drawer>
  );
};

BlacklistAddDrawerComponent.displayName = 'BlacklistAddDrawerComponent';
