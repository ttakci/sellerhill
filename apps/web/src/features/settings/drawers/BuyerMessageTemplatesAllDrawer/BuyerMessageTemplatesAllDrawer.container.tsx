import { BuyerMessageEventType } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BuyerMessageTemplatesAllDrawerComponent } from './BuyerMessageTemplatesAllDrawer.component';
import type { BuyerMessageEventFilter, BuyerMessageTemplatesAllDrawerProps } from './BuyerMessageTemplatesAllDrawer.types';

import { useDeleteBuyerMessageTemplateMutation } from '@/features/buyer-messaging/api/buyer-messaging.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

/**
 * "All templates" list drawer, reached from the carousel drawer's "view all"
 * card. Renders every buyer message template — including the user's seeded
 * per-event defaults — as a card; clicking a card selects it, and the footer
 * "Continue" action opens the edit drawer flow (onEdit) for the selected
 * template.
 */
export const BuyerMessageTemplatesAllDrawer: React.FC<BuyerMessageTemplatesAllDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  templates,
  onEdit,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<BuyerMessageEventFilter>('all');
  const [wasOpen, setWasOpen] = useState(isOpen);

  const [deleteTemplate, { isLoading: isDeleting }] = useDeleteBuyerMessageTemplateMutation();

  // Reset selection/pending-delete/filter when the drawer transitions to
  // closed — without an effect (avoids cascading setState-in-effect).
  // Render-time guard per the React "adjusting state when a prop changes" pattern.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setSelectedId(null);
      setPendingDeleteId(null);
      setEventFilter('all');
    }
  }

  const filteredTemplates = useMemo(
    () => (eventFilter === 'all' ? templates : templates.filter((tpl) => tpl.eventType === eventFilter)),
    [templates, eventFilter],
  );

  const eventFilterOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('storeSettings:storeSettings.messaging.templates.list.allEvents') },
      ...Object.values(BuyerMessageEventType).map((ev) => ({
        value: ev,
        label: t(`storeSettings:storeSettings.messaging.events.${ev}`),
      })),
    ],
    [t],
  );

  const handleSelect = (id: string): void => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleContinue = (): void => {
    if (selectedId) {
      onEdit(selectedId);
    }
  };

  const handleConfirmDelete = (): void => {
    if (!pendingDeleteId) {
      return;
    }
    const id = pendingDeleteId;
    void deleteTemplate(id)
      .unwrap()
      .then(() => {
        setPendingDeleteId(null);
        setSelectedId((prev) => (prev === id ? null : prev));
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        setPendingDeleteId(null);
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(error),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
  };

  const pendingTemplate = templates.find((tpl) => tpl.id === pendingDeleteId) ?? null;

  return (
    <BuyerMessageTemplatesAllDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      templates={filteredTemplates}
      eventFilter={eventFilter}
      eventFilterOptions={eventFilterOptions}
      onEventFilterChange={setEventFilter}
      defaultBadgeLabel={t('storeSettings:storeSettings.messaging.systemTemplate')}
      customBadgeLabel={t('storeSettings:storeSettings.messaging.customTemplate')}
      selectedId={selectedId}
      isContinueDisabled={selectedId === null}
      onSelect={handleSelect}
      onContinue={handleContinue}
      onDeleteRequest={setPendingDeleteId}
      isDeleting={isDeleting}
      titleLabel={t('storeSettings:storeSettings.messaging.templates.list.title')}
      subtitleLabel={t('storeSettings:storeSettings.messaging.templates.list.subtitle')}
      emptyTitle={t('storeSettings:storeSettings.messaging.templates.list.empty')}
      emptyDescription={t('storeSettings:storeSettings.messaging.templates.list.emptyDescription')}
      deleteLabel={t('storeSettings:storeSettings.messaging.templates.delete')}
      isConfirmOpen={pendingDeleteId !== null}
      confirmDescription={t('storeSettings:storeSettings.messaging.templates.deleteConfirmDescription', {
        name: pendingTemplate?.name ?? '',
      })}
      confirmLabel={t('translation:common.delete')}
      cancelLabel={t('translation:common.cancel')}
      onCloseConfirm={() => setPendingDeleteId(null)}
      onConfirmDelete={handleConfirmDelete}
    />
  );
};

BuyerMessageTemplatesAllDrawer.displayName = 'BuyerMessageTemplatesAllDrawer';
