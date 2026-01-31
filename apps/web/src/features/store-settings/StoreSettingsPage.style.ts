import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 25rem; /* 400px */
  color: ${tkn('colors.text.secondary')};
`;

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  box-sizing: border-box;
  padding-bottom: 2.5rem; /* 40px */
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0;

  @media (max-width: 47.9375rem) {
    /* 767px */
    flex-direction: column;
    gap: ${tkn('spacing.md')};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */
`;

export const PageTitle = styled.h1`
  font-size: 1.5rem; /* 24px */
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};

  @media (max-width: 47.9375rem) {
    /* 767px */
    width: 100%;

    & > button {
      flex: 1;
      justify-content: center;
    }
  }
`;

export const GlobalSettingsCard = styled.div`
  margin-top: 0.5rem; /* 8px */
`;

export const GlobalBanner = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: ${tkn('radius.lg')};
  padding: 1rem; /* 16px - Reduced desktop padding */
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem; /* 24px */
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
  width: 100%;

  @media (max-width: 63.9375rem) {
    /* 1023px */
    flex-direction: column;
    align-items: stretch;
    padding: 1.25rem 1rem; /* 20px 16px */
    gap: 1.25rem; /* 20px */
  }
`;

export const SwitchGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem; /* 16px */
  min-width: 0;
  flex: 1;
`;

export const SwitchLabelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem; /* 2px */
`;

export const StoreSelectWrapper = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  opacity: ${({ $disabled }) => ($disabled ? 0.7 : 1)};
  pointer-events: ${({ $disabled }) => ($disabled ? 'none' : 'auto')};
  flex-shrink: 0;

  & > * {
    width: 100%;
    max-width: 20rem; /* 320px */
  }

  @media (max-width: 63.9375rem) {
    /* 1023px */
    max-width: 17.5rem; /* 280px - Constrained width on mobile */
    align-self: flex-start; /* Or center if preferred */
    justify-content: flex-start;
  }
`;

export const StoreLabel = styled.label`
  font-size: 0.6875rem; /* 11px */
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  letter-spacing: 0.05em;
`;

export const GlobalGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.lg')};

  @media (max-width: 74.9375rem) {
    /* 1199px */
    grid-template-columns: 1fr;
  }

  & .custom-shadow {
    box-shadow: ${tkn('shadows.sm')};
    border-radius: ${tkn('radius.lg')};
    overflow: hidden;
  }
`;

export const SectionHeader = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem; /* 16px */
  background: ${tkn('colors.surface.primary')};

  @media (max-width: 63.9375rem) {
    /* 1023px */
    flex-direction: column;
    align-items: stretch;
    gap: 1rem; /* 16px */
    padding: ${tkn('spacing.md')};
  }
`;

export const HeaderIconWrapper = styled.div<{ $type?: 'location' | 'validation' | 'blacklist' }>`
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  border-radius: 0.625rem; /* 10px */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${({ $type, theme }) => {
    switch ($type) {
      case 'location':
        return `
          background: ${theme.colors.brand.secondary};
          color: ${theme.colors.brand.primary};
        `;
      case 'validation':
        return `
          background: ${theme.colors.semantic.warning}15;
          color: ${theme.colors.semantic.warning};
        `;
      case 'blacklist':
        return `
          background: ${theme.colors.semantic.error}10;
          color: ${theme.colors.semantic.error};
        `;
      default:
        return `
          background: ${theme.colors.background.tertiary};
          color: ${theme.colors.text.primary};
        `;
    }
  }}
`;

export const SectionTitleContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem; /* 2px */
  flex: 1;
`;

export const SectionTitle = styled.h3`
  font-size: 1rem; /* 16px */
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const PaddingContainer = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const LocationColumnGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.625rem; /* 10px */
`;

export const LocationGridSpacer = styled.div`
  display: block;
  min-height: 0.0625rem; /* 1px */
  @media (max-width: 47.9375rem) {
    /* 767px */
    display: none;
  }
`;

export const ValidationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem; /* 16px */
`;

export const SwitchItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem; /* 16px */
`;

export const BlacklistCard = styled(Card)`
  box-shadow: ${tkn('shadows.sm')};
  border-radius: ${tkn('radius.lg')} !important;
  overflow: hidden;
`;

export const BlacklistTitleColumn = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem; /* 16px */
  flex: 1;
  min-width: 0;
`;

export const BlacklistGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 1rem;
  padding: 1rem;

  @media (max-width: 40rem) {
    /* 640px */
    grid-template-columns: 1fr;
    padding: 0.5rem 0;
  }
`;

export const BlacklistContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const BlacklistControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  max-width: 50%;
  flex-shrink: 0;

  @media (max-width: 63.9375rem) {
    /* 1023px */
    max-width: 100%;
    justify-content: center; /* Centered on mobile as requested */
    margin-top: 0.5rem; /* 8px */
  }
`;

export const BlacklistActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px - Compact spacing like Stitch */
  width: fit-content;

  @media (max-width: 40rem) {
    /* 640px */
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 0.75rem; /* 12px */
  }
`;

export const BlacklistInputWrapper = styled.div`
  flex: 1;
  min-width: 15rem; /* 240px - Wider input like Stitch */

  @media (max-width: 40rem) {
    /* 640px */
    width: 100%;
    min-width: 0;
  }
`;

export const ScopeActionWrapper = styled.div`
  width: 7.5rem; /* 120px - Compact select like Stitch */
  flex-shrink: 0;

  @media (max-width: 40rem) {
    /* 640px */
    width: 100%;
  }
`;

export const AddActionWrapper = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;

  @media (max-width: 40rem) {
    /* 640px */
    width: 100%;
  }
`;

export const IconAction = styled.button`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: 0.375rem; /* 6px */
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: ${tkn('colors.text.tertiary')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${(p) => p.theme.colors.semantic.error}15;
    color: ${(p) => p.theme.colors.semantic.error};
  }
`;

export const Footer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem; /* 16px */
  margin-top: 1.5rem; /* 24px */
`;

export const FooterLinks = styled.div`
  display: flex;
  gap: 1.5rem; /* 24px */

  a {
    font-size: 0.6875rem; /* 11px */
    font-weight: 700;
    color: ${tkn('colors.text.tertiary')};
    text-decoration: none;
    letter-spacing: 0.05em;

    &:hover {
      color: ${tkn('colors.text.secondary')};
    }
  }
`;

export const Copyright = styled.div`
  font-size: 0.8125rem; /* 13px */
  color: ${tkn('colors.text.tertiary')};
`;
