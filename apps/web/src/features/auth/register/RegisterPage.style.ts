/**
 * RegisterPage Styles
 */

import styled from '@emotion/styled';
import { Button, tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: ${tkn('colors.background.primary')};
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
`;

export const LayoutWrapper = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  flex-wrap: wrap;

  @media (min-width: 64rem) {
    /* 1024px */
    flex-wrap: nowrap;
  }
`;

export const FormPanel = styled.div`
  flex: 1 1 100%;
  width: 100%;
  background: ${tkn('colors.surface.primary')};
  padding: ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  overflow-y: auto;
  z-index: 1;

  @media (min-width: 64rem) {
    /* 1024px */
    flex: 0 0 50%;
    width: 50%;
    padding: ${tkn('spacing.xxxl')};
  }
`;

export const BrandingPanel = styled.div`
  flex: 1 1 100%;
  width: 100%;
  height: 100%;
  padding: ${tkn('spacing.xxxl')};
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;

  @media (min-width: 64rem) {
    /* 1024px */
    display: flex;
    flex: 0 0 50%;
    width: 50%;
  }
`;

/* Additional Tiled decor elements to mimic the mosaic in the image */
export const DecorationArea = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
`;

export const AuthCard = styled.div`
  width: 100%;
  max-width: 34.375rem; /* 550px */
  background: ${tkn('colors.surface.primary')};

  @media (max-width: 40rem) {
    /* 640px */
    padding: 0;
  }
`;

export const BackLink = styled(Button)`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-bottom: ${tkn('spacing.xl')};
`;

export const Header = styled.div`
  margin-bottom: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 40rem) {
    /* 640px */
    grid-template-columns: 1fr 1fr;
  }
`;

export const ButtonContainer = styled.div`
  margin-top: ${tkn('spacing.md')};
`;

export const Footer = styled.div`
  margin-top: ${tkn('spacing.xl')};
  text-align: center;
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  justify-content: center;
`;

export const FooterLink = styled(Button)``;

export const GoogleButtonRow = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const OrDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.lg')};
  width: 100%;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${tkn('colors.border.primary')};
  }
`;

export const BrandingContent = styled.div`
  max-width: 25rem; /* 400px */
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.md')};
  z-index: 2;
`;

export const BrandingLogoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.md')};
  width: 100%;
  max-width: 22rem;
  overflow: visible;

  & img {
    width: 100% !important;
    height: auto !important;
    max-width: 100% !important;
    max-height: 18rem !important;
    object-fit: contain !important;
  }
`;

export const SloganWrapper = styled.div`
  font-family: ${tkn('typography.fontFamily.sans')};
  color: ${tkn('colors.text.inverse')};
  font-size: ${tkn('typography.fontSize.xxxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  min-height: 6.5rem;
  line-height: ${tkn('typography.lineHeight.tight')};
  display: flex;
  align-items: flex-start;
  text-align: center;
  justify-content: center;
`;
