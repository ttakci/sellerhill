import { TemplateType } from '@repo/shared';
import { Drawer, EmptyState } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, CardGrid, FormCard } from './ListingGroupsAllDrawer.style';
import type { ListingGroupsAllDrawerComponentProps } from './ListingGroupsAllDrawer.types';

import { ListingGroupCard } from '@/features/settings/components/ListingGroupCard';

/**
 * Presentation for the full "all groups" list — reached from the hub drawer's
 * "view all" link. Clicking a card selects it; the footer "Continue" opens the
 * edit flow, mirroring the buyer message templates list.
 */
export const ListingGroupsAllDrawerComponent: React.FC<ListingGroupsAllDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
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
  const { t } = useTranslation(['translation']);
  const resolveTemplateName = (g: ListingGroupsAllDrawerComponentProps['groups'][number]): string | undefined => {
    if (g.templates.type !== TemplateType.PREDEFINED || !g.templates.predefinedTemplateId) {
      return undefined;
    }
    return predefinedTemplateNames[g.templates.predefinedTemplateId];
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      title={titleLabel}
      subtitle={subtitleLabel}
      size="lg"
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
          <FormCard>
            <EmptyState icon="layers" title={emptyTitle} description={emptyDescription} />
          </FormCard>
        )}
      </BodyStack>
    </Drawer>
  );
};

ListingGroupsAllDrawerComponent.displayName = 'ListingGroupsAllDrawerComponent';
