import { Drawer, ModernSelect, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';


import { BodyStack, CardGrid } from './BlacklistListDrawer.style';
import type { BlacklistListDrawerComponentProps } from './BlacklistListDrawer.types';

import { BlacklistCard } from '@/features/store-settings/components/BlacklistCard';

export const BlacklistListDrawerComponent: React.FC<BlacklistListDrawerComponentProps> = ({
  isOpen,
  onClose,
  scopeOptions,
  selectedScope,
  onSelectScope,
  items,
  onRemove,
  emptyMessage,
}) => {
  const { t } = useTranslation(['translation']);
  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.blacklist.list.title')}
      subtitle={t('translation:settingsHub.drawer.blacklist.list.subtitle')}
      size="md"
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
        {items.length > 0 ? (
          <CardGrid>
            {items.map((item) => (
              <BlacklistCard
                key={`${item.keyword}-${item.scope}`}
                keyword={item.keyword}
                scope={item.scope}
                onRemove={() => onRemove(item.keyword, item.scope)}
              />
            ))}
          </CardGrid>
        ) : (
          <Text variant="body-sm" color="text.secondary">
            {emptyMessage}
          </Text>
        )}
      </BodyStack>
    </Drawer>
  );
};

BlacklistListDrawerComponent.displayName = 'BlacklistListDrawerComponent';
