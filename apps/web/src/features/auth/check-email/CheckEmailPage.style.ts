/**
 * CheckEmailPage Styles
 *
 * Two-panel layout — consistent with Login / Register pages.
 * Left panel: Branding (logo + MeshBackground)
 * Right panel: Check-email content
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

export const DecorationArea = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
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

export const AuthCard = styled.div`
  width: 100%;
  max-width: 34.375rem; /* 550px */
  background: ${tkn('colors.surface.primary')};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const IconContainer = styled.div`
  width: 5.5rem; /* 88px */
  height: 5.5rem; /* 88px */
  background-color: ${tkn('colors.semanticTint.info')};
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.info')};
  color: ${tkn('colors.semantic.info')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.full')};
  margin-bottom: ${tkn('spacing.xl')};

  @media (max-width: 40rem) {
    width: 4rem;
    height: 4rem;
    margin-bottom: ${tkn('spacing.lg')};
  }
`;

export const Header = styled.div`
  margin-bottom: ${tkn('spacing.xxl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  align-items: center;
`;

export const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  max-width: 20rem; /* 320px */
`;

export const ResendRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.xl')};
`;

export const ResendButton = styled(Button)`
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  min-width: auto;
`;
