import { Button, Card, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ConnectEbayPrompt.style';
import type { ConnectEbayPromptProps } from './ConnectEbayPrompt.types';

export const ConnectEbayPrompt = ({
  onConnect,
  onSkip: _onSkip,
  isLoading,
  className,
}: ConnectEbayPromptProps): React.ReactElement => {
  const { t } = useTranslation(['ebay', 'translation']);

  return (
    <Card variant="bordered" padding="lg" className={className}>
      <S.Inner>
        <S.IconWrapper>
          <Icon name="storefront" size={40} />
        </S.IconWrapper>

        <Text variant="h3" weight="semibold">
          {t('ebay:ebay.accounts.noAccounts')}
        </Text>

        <S.Description variant="body" color="text.secondary">
          {t('ebay:ebay.onboarding.description')}
        </S.Description>

        <Button onClick={onConnect} variant="primary" isLoading={isLoading}>
          <Text>{t('ebay:ebay.connect.connectButton')}</Text>
        </Button>
      </S.Inner>
    </Card>
  );
};

ConnectEbayPrompt.displayName = 'ConnectEbayPrompt';
