import React from 'react';
import { useTranslation } from 'react-i18next';

import { ListingGroupsDrawerComponent } from './ListingGroupsDrawer.component';
import type { ListingGroupsDrawerProps } from './ListingGroupsDrawer.types';

/**
 * "Listing Settings Groups" hub drawer, opened from the single settings-hub
 * row. Cards click straight to the edit flow, "view all" opens the full list,
 * and the footer card starts a new group — the same three exits the buyer
 * message templates hub offers. The hub owns which drawer is active, so
 * opening edit/create/all automatically closes this one.
 */
export const ListingGroupsDrawer: React.FC<ListingGroupsDrawerProps> = ({
  isOpen,
  onClose,
  groups,
  predefinedTemplateNames,
  onEdit,
  onCreate,
  onViewAll,
}) => {
  const { t } = useTranslation(['translation', 'listingSettingsGroup']);

  return (
    <ListingGroupsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      groups={groups}
      predefinedTemplateNames={predefinedTemplateNames}
      onEdit={onEdit}
      onCreate={onCreate}
      onViewAll={onViewAll}
      titleLabel={t('translation:settingsHub.drawer.listingGroup.list.title')}
      subtitleLabel={t('translation:settingsHub.drawer.listingGroup.list.subtitle')}
      viewAllLabel={t('translation:settingsHub.sections.listingGroups.viewAll')}
      createTitle={t('translation:settingsHub.sections.listingGroups.create')}
      createSubtitle={t('translation:settingsHub.sections.listingGroups.createSubtitle')}
      emptyTitle={t('listingSettingsGroup:listingSettingsGroup.emptyState.title')}
      emptyDescription={t('listingSettingsGroup:listingSettingsGroup.emptyState.description')}
    />
  );
};

ListingGroupsDrawer.displayName = 'ListingGroupsDrawer';
