import styled from '@emotion/styled';
import {
  Card,
  StatusBadge as StatusBadgeMolecule,
  Text,
  tkn,
} from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  box-sizing: border-box;
  padding-bottom: 2.5rem; /* 40px */
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
    max-width: 17.5rem; /* 280px */
    align-self: flex-start;
    justify-content: flex-start;
  }
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

export const SectionTitle = styled(Text)``;

export const LocationColumnGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.625rem; /* 10px */
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
  overflow: hidden;
`;

export const BlacklistTitleColumn = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem; /* 16px */
  flex: 1;
  min-width: 0;
`;

export const BlacklistActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: fit-content;

  @media (max-width: 40rem) {
    /* 640px */
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 0.75rem;
  }
`;

export const BlacklistInputWrapper = styled.div`
  flex: 1;
  min-width: 15rem; /* 240px */

  @media (max-width: 40rem) {
    /* 640px */
    width: 100%;
    min-width: 0;
  }
`;

export const ScopeActionWrapper = styled.div`
  width: 7.5rem; /* 120px */
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

export const BadgeWrapper = styled.div`
  display: flex;
  align-items: center;
`;

export const StatusBadge = styled(StatusBadgeMolecule)`
  text-transform: uppercase;
  letter-spacing: 0.025em;
`;

export const EmptyBlacklistText = styled(Text)`
  text-align: center;
  grid-column: 1 / -1;
  padding: 2rem;
`;
