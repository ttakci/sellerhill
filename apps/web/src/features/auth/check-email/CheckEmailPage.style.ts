/**
 * CheckEmailPage Styles
 */

import styled from '@emotion/styled';
import { Button, Text, tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  min-height: 100vh;
  background: ${tkn('colors.background.primary')};
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
`;

export const LayoutWrapper = styled.div`
  display: flex;
  width: 100%;
  flex-wrap: wrap;

  @media (min-width: 64rem) {
    /* 1024px */
    flex-wrap: nowrap;
  }
`;

export const LeftPanel = styled.div`
  flex: 1 1 100%;
  width: 100%;
  background: ${tkn('colors.surface.primary')};
  padding: ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;

  @media (min-width: 64rem) {
    /* 1024px */
    flex: 0 0 50%;
    width: 50%;
    padding: ${tkn('spacing.xxxl')};
  }
`;

export const RightPanel = styled.div`
  flex: 1 1 100%;
  width: 100%;
  background: #020d23; /* Deep Navy from TailAdmin Demo */
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

  /* Decorative Grid Pattern */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.05) 0.0625rem, transparent 0.0625rem),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0.0625rem, transparent 0.0625rem); /* 1px */
    background-size: 3.125rem 3.125rem; /* 50px 50px */
    z-index: 0;
  }

  /* Mosaic effect */
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.02) 0.125rem, transparent 0.125rem); /* 2px */
    background-size: 1.5625rem 1.5625rem; /* 25px 25px */
    z-index: 1;
    opacity: 0.5;
  }
`;

export const MosaicDecor = styled.div`
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 0;

  & > div {
    position: absolute;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0.25rem; /* 4px */
  }

  .box-1 {
    width: 6.25rem;
    height: 6.25rem;
    top: 20%;
    left: 10%;
  } /* 100px */
  .box-2 {
    width: 9.375rem;
    height: 9.375rem;
    top: 60%;
    left: 70%;
    background: rgba(255, 255, 255, 0.02);
  } /* 150px */
  .box-3 {
    width: 5rem;
    height: 5rem;
    top: 10%;
    left: 80%;
  } /* 80px */
  .box-4 {
    width: 7.5rem;
    height: 7.5rem;
    top: 80%;
    left: 20%;
    background: rgba(255, 255, 255, 0.04);
  } /* 120px */
`;

export const AuthCard = styled.div`
  width: 100%;
  max-width: 34.375rem; /* 550px */
  background: ${tkn('colors.surface.primary')};
  text-align: center;
`;

export const LogoWrapper = styled.div`
  margin-bottom: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const IconContainer = styled.div`
  width: 5rem; /* 80px */
  height: 5rem; /* 80px */
  background-color: ${tkn('colors.brand.primary')}15;
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.full')};
  margin: 0 auto ${tkn('spacing.xl')};
`;

export const Header = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.xl')};
`;

export const ResendButton = styled(Button)`
  margin-top: ${tkn('spacing.md')};
`;

export const BrandingContent = styled.div`
  max-width: 25rem; /* 400px */
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xl')};
  z-index: 2;
`;

export const BrandingLogoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const LogoText = styled(Text)`
  margin-top: 1rem;
`;

export const ResendInfo = styled(Text)`
  margin-top: 1.5rem;
`;

export const BrandingDescription = styled(Text)`
  opacity: 0.8;
`;

export const BrandingIconContainer = styled.div`
  margin-top: 2rem;
  opacity: 0.1;
`;
