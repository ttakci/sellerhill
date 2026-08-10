import { ConfirmModal, Drawer, QuickActionCard } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack } from './BuyerMessageTemplatesDrawer.style';
import type { BuyerMessageTemplatesDrawerComponentProps } from './BuyerMessageTemplatesDrawer.types';

import { AccountCarousel } from '@/features/settings/components/AccountCarousel';
import { BuyerMessageTemplateCard } from '@/features/settings/components/BuyerMessageTemplateCard';

export const BuyerMessageTemplatesDrawerComponent: React.FC<BuyerMessageTemplatesDrawerComponentProps> = ({
  isOpen,
  onClose,
  templates,
  onEdit,
  onCreate,
  onViewAll,
  defaultBadgeLabel,
  customBadgeLabel,
  eventLabel,
  onDeleteRequest,
  deleteLabel,
  isDeleting,
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
      title={t('storeSettings:storeSettings.messaging.templates.hub.title')}
      subtitle={t('storeSettings:storeSettings.messaging.templates.hub.subtitle')}
      size="lg"
    >
      <BodyStack>
        <AccountCarousel
          items={templates}
          keyExtractor={(tpl) => tpl.id}
          renderCard={(tpl) => (
            <BuyerMessageTemplateCard
              template={tpl}
              eventLabel={eventLabel(tpl.eventType)}
              defaultBadgeLabel={defaultBadgeLabel}
              customBadgeLabel={customBadgeLabel}
              onClick={onEdit}
              onDelete={onDeleteRequest}
              deleteLabel={deleteLabel}
            />
          )}
          onViewAll={onViewAll}
          viewAllLabel={t('storeSettings:storeSettings.messaging.templates.hub.viewAll.title')}
        />
        <QuickActionCard
          variant="brand"
          title={t('storeSettings:storeSettings.messaging.templates.hub.addNew.title')}
          subtitle={t('storeSettings:storeSettings.messaging.templates.hub.addNew.subtitle')}
          onClick={onCreate}
        />
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
