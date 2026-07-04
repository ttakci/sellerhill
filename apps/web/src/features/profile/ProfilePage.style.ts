import styled from '@emotion/styled';
import { Badge, Button, TextInput, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem; /* 1440px */
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

/* User Overview Section */
export const UserOverview = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

/* Avatar Wrapper for overlapping edit button */
export const AvatarWrapper = styled.div`
  position: relative;
  width: 6rem; /* 96px */
  height: 6rem; /* 96px */

  /* Edit button absolute positioning */
  button {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 2rem; /* 32px */
    height: 2rem; /* 32px */
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 0.125rem solid ${tkn('colors.surface.primary')}; /* 2px */
    box-shadow: ${tkn('shadows.sm')};
    background: ${tkn('colors.brand.primary')};
    color: ${tkn('colors.surface.primary')};

    &:hover {
      background: ${tkn('colors.brand.primary')};
      opacity: 0.9;
      transform: scale(1.05);
    }
  }
`;

export const ProfileHeaderContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  text-align: center;

  @media (min-width: 48rem) {
    /* 768px */
    text-align: left;
  }
`;

export const ProfileBadges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};

  @media (min-width: 48rem) {
    /* 768px */
    justify-content: flex-start;
  }
`;

export const BadgeItem = styled(Badge)`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs+')}; /* 6px */

  &::after {
    content: '';
    display: block;
    width: 0.25rem; /* 4px */
    height: 0.25rem; /* 4px */
    background: ${tkn('colors.border.secondary')}; /* Dot separator */
    border-radius: 50%;
  }

  &:last-child::after {
    display: none;
  }
`;

export const SectionTitleWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
`;

export const SectionContent = styled.div`
  padding: ${tkn('spacing.xl')};
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.xl')} ${tkn('spacing.xxl')};

  @media (min-width: 48rem) {
    /* 768px */
    grid-template-columns: 1fr 1fr;
  }
`;

export const FooterActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.md')};
  padding-top: ${tkn('spacing.md')};
`;

export const DeleteButton = styled(Button)``;

/* Input overrides for clean look */
export const CleanInput = styled(TextInput)`
  width: 100%;
`;

// Re-exporting modified base components or adding new ones

export const UserInfoWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
`;

export const AvatarContainer = styled.div`
  width: 5rem; /* 80px */
  height: 5rem; /* 80px */
  border-radius: 50%;
  overflow: hidden;
  border: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
  background: ${tkn('colors.surface.secondary')};
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const UserTextInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

/* Info Grid Layout */
export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.xl')};

  @media (min-width: 48rem) {
    /* 768px */
    grid-template-columns: 1fr 1fr;
  }
`;

export const InfoItem = styled.div<{ $fullWidth?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  ${({ $fullWidth }) => $fullWidth && 'grid-column: 1 / -1;'}
`;

export const InfoLabel = styled.div`
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const InfoValue = styled.div`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  word-break: break-all;
`;

export const BioItem = styled(InfoItem)`
  grid-column: 1 / -1;
`;

export const ActionGroup = styled.div`
  display: flex;
  align-items: center;
`;

/* Form Styles (for editing mode later or as placeholder) */
export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    /* 768px */
    grid-template-columns: 1fr 1fr;
  }
`;

export const HeaderTextWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
`;

export const FallbackAvatar = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: ${tkn('colors.background.tertiary')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const UserOverviewLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xl')};
`;

export const EditButtonWrapper = styled.div`
  align-self: flex-start;
`;

export const ErrorMessage = styled.div`
  margin-top: ${tkn('spacing.xs')};
`;

export const SectionCard = styled.div`
  margin-top: ${tkn('spacing.xl')};
  overflow: hidden;
`;
