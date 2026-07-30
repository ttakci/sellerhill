/**
 * VerifyEmailPage Styles
 *
 * Two-panel layout — consistent with Login / Register / CheckEmail pages.
 * Left panel: Branding (logo + MeshBackground)
 * Right panel: Verification content
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

  @media (min-width: ${tkn('breakpoints.lg')}) {
    /* 1024px */
    flex-wrap: nowrap;
  }
`;

export const BrandingPanel = styled.div`
  flex: 1 1 100%;
  width: 100%;
  height: 100%;
  padding: ${tkn('spacing.xl')};
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;

  @media (min-width: ${tkn('breakpoints.lg')}) {
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

  @media (min-width: ${tkn('breakpoints.lg')}) {
    /* 1024px */
    flex: 0 0 50%;
    width: 50%;
    padding: ${tkn('spacing.xl')};
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

export const StatusIconWrapper = styled.div<{ $type: 'success' | 'error' | 'loading' }>`
  width: 5.5rem; /* 88px */
  height: 5.5rem; /* 88px */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.full')};
  margin-bottom: ${tkn('spacing.md')};

  background-color: ${(p) => {
    switch (p.$type) {
      case 'success':
        return `${tkn('colors.semanticTint.success')(p)}`;
      case 'error':
        return `${tkn('colors.semanticTint.error')(p)}`;
      default:
        return `${tkn('colors.semanticTint.info')(p)}`;
    }
  }};

  border: 0.0625rem solid
    ${(p) => {
      switch (p.$type) {
        case 'success':
          return `${tkn('colors.semanticTintBorder.success')(p)}`;
        case 'error':
          return `${tkn('colors.semanticTintBorder.error')(p)}`;
        default:
          return `${tkn('colors.semanticTintBorder.info')(p)}`;
      }
    }};

  color: ${(p) => {
    switch (p.$type) {
      case 'success':
        return tkn('colors.semantic.success');
      case 'error':
        return tkn('colors.semantic.error');
      default:
        return tkn('colors.semantic.info');
    }
  }};

  @media (max-width: 40rem) {
    width: 4rem;
    height: 4rem;
    margin-bottom: ${tkn('spacing.lg')};
  }
`;

export const Header = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
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

export const ResendButton = styled(Button)`
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  width: 100%;
  transition: background-color ${tkn('transitions.fast')};
`;
