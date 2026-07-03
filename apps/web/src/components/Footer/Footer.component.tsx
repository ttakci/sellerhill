import { Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './Footer.style';

export const Footer: React.FC = () => {
  const { t } = useTranslation('translation');

  return (
    <S.FooterWrapper>
      <Text variant="body-xs" weight="medium" color="text.tertiary">
        {t('footer.copyright')}
      </Text>
      <S.Links>
        <S.LinkItem href="#">{t('footer.privacyPolicy')}</S.LinkItem>
        <S.LinkItem href="#">{t('footer.termsOfService')}</S.LinkItem>
        <S.LinkItem href="#">{t('footer.contactSupport')}</S.LinkItem>
      </S.Links>
    </S.FooterWrapper>
  );
};
