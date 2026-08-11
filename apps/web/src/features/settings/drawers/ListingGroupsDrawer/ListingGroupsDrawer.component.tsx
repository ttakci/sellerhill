import { TemplateType } from '@repo/shared';
import { Drawer, EmptyState, QuickActionCard } from '@repo/ui';
import React from 'react';

import { BodyStack, FormCard } from './ListingGroupsDrawer.style';
import type { ListingGroupsDrawerComponentProps } from './ListingGroupsDrawer.types';

import { AccountCarousel } from '@/features/settings/components/AccountCarousel';
import { ListingGroupCard } from '@/features/settings/components/ListingGroupCard';

/**
 * Presentation for the "Listing Settings Groups" hub drawer — the single
 * settings-hub row for groups. Same shape as the buyer-message templates hub:
 * a carousel of the first few groups (with "view all" beyond that) over an
 * "add new" card, so viewing, editing and creating live behind one row.
 */
export const ListingGroupsDrawerComponent: React.FC<ListingGroupsDrawerComponentProps> = ({
  isOpen,
  onClose,
  groups,
  predefinedTemplateNames,
  onEdit,
  onCreate,
  onViewAll,
  titleLabel,
  subtitleLabel,
  viewAllLabel,
  createTitle,
  createSubtitle,
  emptyTitle,
  emptyDescription,
}) => {
  const resolveTemplateName = (g: ListingGroupsDrawerComponentProps['groups'][number]): string | undefined => {
    if (g.templates.type !== TemplateType.PREDEFINED || !g.templates.predefinedTemplateId) {
      return undefined;
    }
    return predefinedTemplateNames[g.templates.predefinedTemplateId];
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={titleLabel} subtitle={subtitleLabel} size="lg">
      <BodyStack>
        {groups.length > 0 ? (
          <AccountCarousel
            items={groups}
            keyExtractor={(g) => g.id}
            renderCard={(g) => (
              <ListingGroupCard group={g} onClick={onEdit} templateName={resolveTemplateName(g)} />
            )}
            onViewAll={onViewAll}
            viewAllLabel={viewAllLabel}
          />
        ) : (
          <FormCard>
            <EmptyState icon="layers" title={emptyTitle} description={emptyDescription} />
          </FormCard>
        )}
        <QuickActionCard variant="brand" title={createTitle} subtitle={createSubtitle} onClick={onCreate} />
      </BodyStack>
    </Drawer>
  );
};

ListingGroupsDrawerComponent.displayName = 'ListingGroupsDrawerComponent';
