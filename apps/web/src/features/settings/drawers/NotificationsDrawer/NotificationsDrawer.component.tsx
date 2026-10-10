import { Button, Drawer, Icon, InfoMessage, ModernSelect, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './NotificationsDrawer.style';
import type { NotificationsDrawerComponentProps } from './NotificationsDrawer.types';

export const NotificationsDrawerComponent: React.FC<NotificationsDrawerComponentProps> = ({
  isOpen,
  onClose,
  digestEnabled,
  digestSendHour,
  hourOptions,
  timezone,
  isSaving,
  onDigestEnabledChange,
  onDigestSendHourChange,
  onOpenProfile,
  onSave,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.notifications.title')}
      subtitle={t('translation:settingsHub.drawer.notifications.subtitle')}
      size="md"
      primaryAction={{
        icon: 'save',
        label: t('translation:common.save'),
        onClick: onSave,
        isLoading: isSaving,
      }}
    >
      <S.BodyStack>
        <S.FormCard>
          <S.ToggleRow>
            <Toggle
              checked={digestEnabled}
              onChange={onDigestEnabledChange}
              label={t('translation:settingsHub.drawer.notifications.digestLabel')}
            />
            <Text variant="body-sm" color="text.secondary">
              {t('translation:settingsHub.drawer.notifications.digestDescription')}
            </Text>
          </S.ToggleRow>
          <ModernSelect
            label={t('translation:settingsHub.drawer.notifications.sendTime')}
            options={hourOptions}
            value={digestSendHour}
            onChange={onDigestSendHourChange}
            isDisabled={!digestEnabled}
            fullWidth
          />
          <InfoMessage type="info">
            {t('translation:settingsHub.drawer.notifications.timezoneNote', { timezone })}
          </InfoMessage>
          <S.LinkRow>
            <Button variant="text" size="small" onClick={onOpenProfile}>
              <Icon name="globe" size={16} />
              <Text variant="body-sm" weight="semibold">
                {t('translation:settingsHub.drawer.notifications.changeTimezone')}
              </Text>
            </Button>
          </S.LinkRow>
        </S.FormCard>
      </S.BodyStack>
    </Drawer>
  );
};

NotificationsDrawerComponent.displayName = 'NotificationsDrawerComponent';
