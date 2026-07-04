import styled from '@emotion/styled';
import { Button, Drawer, SwitchRow, Text, tkn } from '@repo/ui';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NotImplementedNotice } from './NotImplementedNotice';

const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
`;

export interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [syncFailures, setSyncFailures] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [productUpdates, setProductUpdates] = useState(false);

  const footer = (
    <FooterRow>
      <Button variant="ghost" onClick={onClose}>
        <Text>{t('translation:common.cancel')}</Text>
      </Button>
      <Button variant="primary" onClick={onClose}>
        <Text>{t('translation:common.save')}</Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.notifications.title')}
      subtitle={t('translation:settingsHub.drawer.notifications.subtitle')}
      footer={footer}
      size="md"
    >
      <BodyStack>
        <NotImplementedNotice />
        <SwitchRow
          title={t(
            'translation:settingsHub.drawer.notifications.emailNotifications',
          )}
          checked={emailNotifications}
          onChange={setEmailNotifications}
        />
        <SwitchRow
          title={t(
            'translation:settingsHub.drawer.notifications.orderAlerts',
          )}
          checked={orderAlerts}
          onChange={setOrderAlerts}
        />
        <SwitchRow
          title={t(
            'translation:settingsHub.drawer.notifications.syncFailures',
          )}
          checked={syncFailures}
          onChange={setSyncFailures}
        />
        <SwitchRow
          title={t(
            'translation:settingsHub.drawer.notifications.weeklyReport',
          )}
          checked={weeklyReport}
          onChange={setWeeklyReport}
        />
        <SwitchRow
          title={t(
            'translation:settingsHub.drawer.notifications.productUpdates',
          )}
          checked={productUpdates}
          onChange={setProductUpdates}
        />
      </BodyStack>
    </Drawer>
  );
};
