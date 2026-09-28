/**
 * AuthShowcase Component (Presentation)
 *
 * Wide left panel for the auth screens — brand mark top-left (links to the
 * landing page), the same real screenshots the landing hero uses (desktop +
 * phone), the SELLERHILL wordmark and the animated slogan line beneath.
 * Below the lg breakpoint the panel is hidden and a slim navy brand bar with
 * the same home link takes its place, so a phone never opens on a bare white
 * page with no brand.
 */

import { Logo, MeshBackground, Typewriter } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AuthShowcase.style';
import type { AuthShowcaseProps } from './AuthShowcase.types';

export const AuthShowcase = ({ className }: AuthShowcaseProps): React.ReactElement => {
  const { t, i18n } = useTranslation(['auth']);
  const locale = i18n.language || 'en';
  const folder = locale.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  const screenSrc = `/landing-screens/${folder}/hero-dashboard.webp`;
  const phoneSrc = `/landing-screens/${folder}/mobile-dashboard.webp`;

  return (
    <>
      <S.MobileBar>
        <S.HomeLink to="/" aria-label={t('auth:auth.showcase.homeLink')}>
          <Logo layout="full" height={30} />
        </S.HomeLink>
      </S.MobileBar>
      <S.Panel className={className}>
        <S.Decoration>
          <MeshBackground animate={true} />
        </S.Decoration>

        <S.BrandTopLeft>
          <S.HomeLink to="/" aria-label={t('auth:auth.showcase.homeLink')}>
            <Logo height={40} />
          </S.HomeLink>
        </S.BrandTopLeft>

        <S.Center>
          <S.DeviceArt>
            <S.DesktopShot src={screenSrc} alt={t('auth:auth.showcase.previewAlt')} />
            <S.PhoneFrame>
              <S.PhoneShot src={phoneSrc} alt="" />
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
    </>
  );
};
