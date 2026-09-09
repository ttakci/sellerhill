/**
 * AuthShowcase Component (Presentation)
 *
 * Wide left panel for the auth screens — brand mark top-left, a decorative
 * product screenshot centered, the SELLERHILL wordmark and the animated
 * slogan line beneath. Presentation only; no interactivity.
 */

import { Logo, MeshBackground, Typewriter } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AuthShowcase.style';
import type { AuthShowcaseProps } from './AuthShowcase.types';

export const AuthShowcase = ({ className }: AuthShowcaseProps): React.ReactElement => {
  const { t, i18n } = useTranslation(['auth']);
  const locale = i18n.language || 'en';
  const screenSrc = `/landing-screens/${locale.toLowerCase().startsWith('tr') ? 'tr' : 'en'}/hero-dashboard.jpg`;

  return (
    <S.Panel className={className}>
      <S.Decoration>
        <MeshBackground animate={true} />
      </S.Decoration>

      <S.BrandTopLeft>
        <Logo height={40} />
      </S.BrandTopLeft>

      <S.Center>
        <S.DeviceArt>
          <S.DesktopShot src={screenSrc} alt={t('auth:auth.showcase.previewAlt')} />
          <S.PhoneFrame>
            <S.PhoneShot src={screenSrc} alt="" />
          </S.PhoneFrame>
        </S.DeviceArt>

        <S.Caption>
          <S.WordmarkWrapper>
            <Logo layout="wordmark" height={26} />
          </S.WordmarkWrapper>

          <S.SloganWrapper>
            <Typewriter
              phrases={[
                t('auth:auth.branding.slogan1'),
                t('auth:auth.branding.slogan2'),
                t('auth:auth.branding.slogan3'),
                t('auth:auth.branding.slogan4'),
              ]}
              typingSpeed={70}
              deletingSpeed={40}
              pauseTime={2500}
            />
          </S.SloganWrapper>
        </S.Caption>
      </S.Center>
    </S.Panel>
  );
};
