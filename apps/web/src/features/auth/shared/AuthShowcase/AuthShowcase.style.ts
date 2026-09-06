/**
 * AuthShowcase Styles
 *
 * The wide left panel shared by /login and /register: brand mark pinned
 * top-left, a decorative desktop + phone device composition centered, the
 * SELLERHILL wordmark, and the animated slogan line beneath it.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Panel = styled.div`
  position: relative;
  flex: 1 1 100%;
  width: 100%;
  height: 100%;
  padding: ${tkn('spacing.xl')};
  display: none;
  overflow: hidden;

  @media (min-width: ${tkn('breakpoints.lg')}) {
    /* 1024px */
    display: flex;
    flex: 0 0 64%;
    width: 64%;
  }
`;

export const Decoration = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
`;

export const BrandTopLeft = styled.div`
  position: absolute;
  top: ${tkn('spacing.xl')};
  left: ${tkn('spacing.xl')};
  z-index: 2;
  display: flex;
  align-items: center;

  & img {
    height: 2.5rem !important;
    width: auto !important;
    max-height: 2.5rem !important;
  }
`;

export const Center = styled.div`
  position: relative;
  z-index: 2;
  margin: auto;
  width: 100%;
  max-width: 32rem; /* 512px — device art + phone overhang */
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const DeviceArt = styled.div`
  position: relative;
  width: 88%;
`;

export const DesktopShot = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
`;

export const PhoneFrame = styled.div`
  position: absolute;
  right: -${tkn('spacing.xl')};
  bottom: -${tkn('spacing.lg')};
  width: 8rem;
  aspect-ratio: 9 / 19;
  border-radius: ${tkn('radius.xl')};
  border: 0.375rem solid ${tkn('colors.sidebar.background')};
  background: ${tkn('colors.sidebar.background')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  overflow: hidden;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    display: none;
  }
`;

export const PhoneShot = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 22% top;
`;

export const Caption = styled.div`
  margin-top: ${tkn('spacing.xxl')};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const WordmarkWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  & img {
    height: 1.625rem !important;
    width: auto !important;
    max-height: 1.625rem !important;
  }
`;

export const SloganWrapper = styled.div`
  font-family: ${tkn('typography.fontFamily.sans')};
  color: ${tkn('colors.text.inverse')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  min-height: 3rem;
  line-height: ${tkn('typography.lineHeight.normal')};
  display: flex;
  align-items: flex-start;
  justify-content: center;
`;
