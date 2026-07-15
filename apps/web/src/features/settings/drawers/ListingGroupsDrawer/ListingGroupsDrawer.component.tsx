import { TemplateType } from '@repo/shared';
import { Drawer, EmptyState } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, CardGrid } from './ListingGroupsDrawer.style';
import type { ListingGroupsDrawerComponentProps } from './ListingGroupsDrawer.types';

import { ListingGroupCard } from '@/features/settings/components/ListingGroupCard';

/**
 * Presentation for the "Listing Settings Groups" list drawer.
 * Shows the group cards in a single-column grid; clicking a card opens the
 * edit flow. The create CTA lives on the settings hub section row, not here.
 */
export const ListingGroupsDrawerComponent: React.FC<ListingGroupsDrawerComponentProps> = ({
  isOpen,
  onClose,
  groups,
  predefinedTemplateNames,
  selectedId,
  isContinueDisabled,
  onSelect,
  onContinue,
  titleLabel,
  subtitleLabel,
  emptyTitle,
  emptyDescription,
}) => {
  const { t } = useTranslation();
  const resolveTemplateName = (g: ListingGroupsDrawerComponentProps['groups'][number]): string | undefined => {
    if (g.templates.type !== TemplateType.PREDEFINED || !g.templates.predefinedTemplateId) {
      return undefined;
    }
    return predefinedTemplateNames[g.templates.predefinedTemplateId];
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={titleLabel}
      subtitle={subtitleLabel}
      size="md"
      primaryAction={{
        label: t('translation:common.continue'),
        onClick: onContinue,
        disabled: isContinueDisabled,
      }}
    >
      <BodyStack>
        {groups.length > 0 ? (
          <CardGrid>
            {groups.map((g) => (
              <ListingGroupCard
                key={g.id}
                group={g}
                onClick={onSelect}
                templateName={resolveTemplateName(g)}
                selected={g.id === selectedId}
              />
            ))}
          </CardGrid>
        ) : (
          <EmptyState icon="layers" title={emptyTitle} description={emptyDescription} />
        )}
      </BodyStack>
    </Drawer>
  );
};

ListingGroupsDrawerComponent.displayName = 'ListingGroupsDrawerComponent';
