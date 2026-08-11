import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListingGroupsAllDrawerComponent } from './ListingGroupsAllDrawer.component';
import type { ListingGroupsAllDrawerProps } from './ListingGroupsAllDrawer.types';

/**
 * "All groups" list drawer, reached from the hub drawer's "view all" link.
 * Renders every listing settings group as a card; clicking a card selects it,
 * and the footer "Continue" action opens the edit drawer flow for it.
 */
export const ListingGroupsAllDrawer: React.FC<ListingGroupsAllDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
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
    <ListingGroupsAllDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      groups={groups}
      predefinedTemplateNames={predefinedTemplateNames}
      selectedId={selectedId}
      isContinueDisabled={selectedId === null}
      onSelect={handleSelect}
      onContinue={handleContinue}
      titleLabel={t('translation:settingsHub.drawer.listingGroup.all.title')}
      subtitleLabel={t('translation:settingsHub.drawer.listingGroup.all.subtitle')}
      emptyTitle={t('listingSettingsGroup:emptyState.title')}
      emptyDescription={t('listingSettingsGroup:emptyState.description')}
    />
  );
};

ListingGroupsAllDrawer.displayName = 'ListingGroupsAllDrawer';
