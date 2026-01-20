/**
 * CheckEmailPage Styles
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';


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

  @media (min-width: 1024px) {
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

  @media (min-width: 1024px) {
    flex: 0 0 50%;
    width: 50%;
    padding: ${tkn('spacing.xxxl')};
  }
`;

export const RightPanel = styled.div`
  flex: 1 1 100%;
  width: 100%;
  background: #020D23; /* Deep Navy from TailAdmin Demo */
  padding: ${tkn('spacing.xxxl')};
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;

  @media (min-width: 1024px) {
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
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 50px 50px;
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
    background-image: 
      radial-gradient(rgba(255, 255, 255, 0.02) 2px, transparent 2px);
    background-size: 25px 25px;
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
    border-radius: 4px;
  }

  .box-1 { width: 100px; height: 100px; top: 20%; left: 10%; }
  .box-2 { width: 150px; height: 150px; top: 60%; left: 70%; background: rgba(255, 255, 255, 0.02); }
  .box-3 { width: 80px; height: 80px; top: 10%; left: 80%; }
  .box-4 { width: 120px; height: 120px; top: 80%; left: 20%; background: rgba(255, 255, 255, 0.04); }
`;

export const AuthCard = styled.div`
  width: 100%;
  max-width: 550px;
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
  width: 80px;
  height: 80px;
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

export const ResendButton = styled.button`
  background: none;
  border: none;
  color: ${tkn('colors.text.tertiary')};
  cursor: pointer;
  font-size: ${tkn('typography.fontSize.sm')};
  margin-top: ${tkn('spacing.md')};
  
  &:hover {
    color: ${tkn('colors.brand.primary')};
    text-decoration: underline;
  }
`;

export const BrandingContent = styled.div`
  max-width: 400px;
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
