import { ConfirmModal, Drawer, EmptyState, ModernSelect } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, CardGrid, FilterRow, FilterSelectWrapper, FormCard } from './BuyerMessageTemplatesAllDrawer.style';
import type { BuyerMessageTemplatesAllDrawerComponentProps } from './BuyerMessageTemplatesAllDrawer.types';

import { BuyerMessageTemplateCard } from '@/features/settings/components/BuyerMessageTemplateCard';

/**
 * Presentation for the full "all templates" list — reached from the carousel
 * drawer's "view all" card. One unified list — the user's seeded per-event
 * defaults are ordinary editable rows here (badged "Default"), not a
 * separate read-only section. Clicking a card selects it for editing.
 */
export const BuyerMessageTemplatesAllDrawerComponent: React.FC<BuyerMessageTemplatesAllDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  templates,
  eventFilter,
  eventFilterOptions,
  onEventFilterChange,
  defaultBadgeLabel,
  customBadgeLabel,
  selectedId,
  isContinueDisabled,
  onSelect,
  onContinue,
  onDeleteRequest,
  isDeleting,
  titleLabel,
  subtitleLabel,
  emptyTitle,
  emptyDescription,
  deleteLabel,
  isConfirmOpen,
  confirmDescription,
  confirmLabel,
  cancelLabel,
  onCloseConfirm,
  onConfirmDelete,
}) => {
  const { t } = useTranslation(['translation', 'storeSettings']);

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
        <FilterRow>
          <FilterSelectWrapper>
            <ModernSelect
              options={eventFilterOptions}
              value={eventFilter}
              onChange={(v) => onEventFilterChange(v as typeof eventFilter)}
              size="small"
              fullWidth
              searchPlaceholder={t('translation:common.search')}
              noResultsMessage={t('translation:common.noResults')}
            />
          </FilterSelectWrapper>
        </FilterRow>

        {templates.length > 0 ? (
          <CardGrid>
            {templates.map((tpl) => (
              <BuyerMessageTemplateCard
                key={tpl.id}
                template={tpl}
                eventLabel={t(`storeSettings:storeSettings.messaging.events.${tpl.eventType}`)}
                defaultBadgeLabel={defaultBadgeLabel}
                customBadgeLabel={customBadgeLabel}
                onClick={onSelect}
                onDelete={onDeleteRequest}
                deleteLabel={deleteLabel}
                selected={tpl.id === selectedId}
              />
            ))}
          </CardGrid>
        ) : (
          <FormCard>
            <EmptyState icon="mail" title={emptyTitle} description={emptyDescription} />
          </FormCard>
        )}
      </BodyStack>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={onCloseConfirm}
        onConfirm={onConfirmDelete}
        type="warning"
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        isLoading={isDeleting}
      />
    </Drawer>
  );
};

BuyerMessageTemplatesAllDrawerComponent.displayName = 'BuyerMessageTemplatesAllDrawerComponent';
