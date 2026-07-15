import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListingGroupsDrawerComponent } from './ListingGroupsDrawer.component';
import type { ListingGroupsDrawerProps } from './ListingGroupsDrawer.types';

/**
 * "Listing Settings Groups" list drawer. Renders every group as a card;
 * clicking a card selects it, and the footer "Continue" action opens the edit
 * drawer flow (onEdit) for the selected group. Creating a new group is
 * triggered from the settings hub section row, not from this list. The hub
 * owns which drawer is active, so opening edit automatically closes this list.
 */
export const ListingGroupsDrawer: React.FC<ListingGroupsDrawerProps> = ({
  isOpen,
  onClose,
  groups,
  predefinedTemplateNames,
  onEdit,
}) => {
  const { t } = useTranslation(['translation', 'listingSettingsGroup']);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(isOpen);

  // Reset the selection when the drawer transitions to closed — without an
  // effect (avoids cascading setState-in-effect). Render-time guard per the
  // React "adjusting state when a prop changes" pattern.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setSelectedId(null);
    }
  }

  const handleSelect = (id: string): void => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleContinue = (): void => {
    if (selectedId) {
      onEdit(selectedId);
    }
  };

  return (
    <ListingGroupsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      groups={groups}
      predefinedTemplateNames={predefinedTemplateNames}
      selectedId={selectedId}
      isContinueDisabled={selectedId === null}
      onSelect={handleSelect}
      onContinue={handleContinue}
      titleLabel={t('translation:settingsHub.drawer.listingGroup.list.title')}
      subtitleLabel={t('translation:settingsHub.drawer.listingGroup.list.subtitle')}
      emptyTitle={t('listingSettingsGroup:emptyState.title')}
      emptyDescription={t('listingSettingsGroup:emptyState.description')}
    />
  );
};

ListingGroupsDrawer.displayName = 'ListingGroupsDrawer';
