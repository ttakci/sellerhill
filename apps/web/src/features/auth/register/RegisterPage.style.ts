/**
 * RegisterPage Styles
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

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

export const BackLink = styled.button`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  background: none;
  border: none;
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.sm')};
  cursor: pointer;
  margin-bottom: ${tkn('spacing.xl')};
  padding: 0;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
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

export const FooterLink = styled.button`
  background: none;
  border: none;
  color: ${tkn('colors.brand.primary')};
  cursor: pointer;
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${tkn('typography.fontSize.sm')};
  padding: 0;

  &:hover {
    text-decoration: underline;
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
  gap: ${tkn('spacing.md')};
`;

export const SloganWrapper = styled.div`
  font-family: ${tkn('typography.fontFamily.sans')};
  color: #ffffff;
  font-size: 2rem;
  font-weight: ${tkn('typography.fontWeight.bold')};
  min-height: 6.5rem;
  line-height: 1.3;
  display: flex;
  align-items: flex-start;
  text-align: center;
  justify-content: center;
`;
