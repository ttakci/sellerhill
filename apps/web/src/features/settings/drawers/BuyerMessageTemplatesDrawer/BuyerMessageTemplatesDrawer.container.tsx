import { useUI } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BuyerMessageTemplatesDrawerComponent } from './BuyerMessageTemplatesDrawer.component';
import type { BuyerMessageTemplatesDrawerProps } from './BuyerMessageTemplatesDrawer.types';

import { useDeleteBuyerMessageTemplateMutation } from '@/features/buyer-messaging/api/buyer-messaging.api';
import { getErrorI18nKey } from '@/utils/errorHandler';

/**
 * "Message Templates" entry point — merges the old "manage" + "create" hub
 * rows into one. A carousel of template cards (card click -> straight to
 * edit, no select-then-continue) with a "New template" card below it; once
 * templates exceed the carousel cap, the last slide becomes a "view all" card
 * opening `BuyerMessageTemplatesAllDrawer`, which is where filtering lives.
 * Delete is duplicated here (rather than only in the "all" list) so it stays
 * reachable even when the carousel never shows a "view all" card.
 */
export const BuyerMessageTemplatesDrawer: React.FC<BuyerMessageTemplatesDrawerProps> = ({
  isOpen,
  onClose,
  templates,
  onEdit,
  onCreate,
  onViewAll,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);
  const { showMessage, closeMessage } = useUI();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(isOpen);

  const [deleteTemplate, { isLoading: isDeleting }] = useDeleteBuyerMessageTemplateMutation();

  // Reset pending-delete when the drawer transitions to closed — without an
  // effect (avoids cascading setState-in-effect). Render-time guard per the
  // React "adjusting state when a prop changes" pattern.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setPendingDeleteId(null);
    }
  }

  const handleConfirmDelete = (): void => {
    if (!pendingDeleteId) {
      return;
    }
    void deleteTemplate(pendingDeleteId)
      .unwrap()
      .then(() => {
        setPendingDeleteId(null);
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
    <BuyerMessageTemplatesDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      templates={templates}
      onEdit={onEdit}
      onCreate={onCreate}
      onViewAll={onViewAll}
      defaultBadgeLabel={t('storeSettings:storeSettings.messaging.systemTemplate')}
      customBadgeLabel={t('storeSettings:storeSettings.messaging.customTemplate')}
      eventLabel={(eventType) => t(`storeSettings:storeSettings.messaging.events.${eventType}`)}
      onDeleteRequest={setPendingDeleteId}
      deleteLabel={t('storeSettings:storeSettings.messaging.templates.delete')}
      isDeleting={isDeleting}
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

BuyerMessageTemplatesDrawer.displayName = 'BuyerMessageTemplatesDrawer';
