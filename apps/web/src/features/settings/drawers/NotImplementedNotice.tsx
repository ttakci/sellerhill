import styled from '@emotion/styled';
import { Icon, Text, tkn } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

const Notice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.semanticTint.warning')};
  border: 1px solid ${tkn('colors.semanticTintBorder.warning')};
`;

const NoticeText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xxs')};
`;

export const NotImplementedNotice: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Notice role="status">
      <Icon name="alert-triangle" color="semantic.warning" size={20} />
      <NoticeText>
        <Text variant="body" weight="semibold">
          {t('translation:settingsHub.notImplemented.title')}
        </Text>
        <Text variant="caption" color="text.secondary">
          {t('translation:settingsHub.notImplemented.description')}
        </Text>
      </NoticeText>
    </Notice>
  );
};
