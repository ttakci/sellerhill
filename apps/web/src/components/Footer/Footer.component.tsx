import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './Footer.style';

export const Footer: React.FC = () => {
  const { t } = useTranslation('translation');

  return (
    <S.FooterWrapper>
      <S.Copyright>{t('footer.copyright')}</S.Copyright>
      <S.Links>
        <S.LinkItem href="#">{t('footer.privacyPolicy')}</S.LinkItem>
        <S.LinkItem href="#">{t('footer.termsOfService')}</S.LinkItem>
        <S.LinkItem href="#">{t('footer.contactSupport')}</S.LinkItem>
      </S.Links>
    </S.FooterWrapper>
  );
};
