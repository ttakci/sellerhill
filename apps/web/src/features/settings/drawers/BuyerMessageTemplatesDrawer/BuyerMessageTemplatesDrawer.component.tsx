import { ConfirmModal, Drawer, EmptyState, ModernSelect } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack, CardGrid, FilterRow, FilterSelectWrapper, FormCard } from './BuyerMessageTemplatesDrawer.style';
import type { BuyerMessageTemplatesDrawerComponentProps } from './BuyerMessageTemplatesDrawer.types';

import { BuyerMessageTemplateCard } from '@/features/settings/components/BuyerMessageTemplateCard';

/**
 * Presentation for the "Manage Message Templates" list drawer. One unified
 * list — the user's seeded per-event defaults are ordinary editable rows here
 * (badged "Default"), not a separate read-only section. Clicking a card
 * selects it for editing; creating a brand new template is triggered from the
 * settings hub section row, not from this list (mirrors Listing Settings Groups).
 */
export const BuyerMessageTemplatesDrawerComponent: React.FC<BuyerMessageTemplatesDrawerComponentProps> = ({
  isOpen,
  onClose,
  templates,
  eventFilter,
  eventFilterOptions,
  onEventFilterChange,
  defaultBadgeLabel,
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

BuyerMessageTemplatesDrawerComponent.displayName = 'BuyerMessageTemplatesDrawerComponent';
