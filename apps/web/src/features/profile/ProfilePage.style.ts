import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 32px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-end;
  }
`;

export const TitleSection = styled.div`
  display: flex;
  flex-direction: column;

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: ${tkn('colors.text.primary')};
    letter-spacing: -0.025em;
    margin: 0;
  }

  p {
    font-size: 14px;
    color: ${tkn('colors.text.secondary')};
    margin-top: 4px;
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

export const MainCard = styled.div`
  background: white;
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.secondary')};
  padding: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const SectionCard = styled.div`
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.lg')};
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  width: 96px;
  height: 96px;
  
  /* Edit button absolute positioning */
  button {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: ${tkn('shadows.sm')};
    background: ${tkn('colors.brand.primary')};
    color: white;
    
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

  @media (min-width: 768px) {
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

  @media (min-width: 768px) {
    justify-content: flex-start;
  }
`;

export const BadgeItem = styled.span`
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.sm')};
  display: flex;
  align-items: center;
  gap: 6px;

  &::after {
    content: '';
    display: block;
    width: 4px;
    height: 4px;
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
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
`;

export const SectionContent = styled.div`
  padding: ${tkn('spacing.xl')};
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.xl')} 48px; /* Hardcoded 48px for 3xl spacing */

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const FooterActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.md')};
  padding-top: ${tkn('spacing.md')};
`;

export const DeleteButton = styled.button`
  color: #DC2626;
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${tkn('typography.fontSize.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: transparent;
  transition: all 0.2s;

  &:hover {
    background: #FEF2F2;
  }
`;

/* Input overrides for clean look */
export const CleanInput = styled.input`
    width: 100%;
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    padding: 0.5rem 0.75rem;
    &:focus {
        outline: 2px solid #2563eb;
        border-color: #2563eb;
    }
`;

// Re-exporting modified base components or adding new ones
export const MainCardHeaderless = styled(MainCard)`
  padding: 0;
  gap: 0;
  overflow: hidden; /* For round corners */
`;

export const UserInfoWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
`;

export const AvatarContainer = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid ${tkn('colors.border.secondary')};
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
  gap: 2px;
`;

/* Info Grid Layout */
export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.xl')};

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
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

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const HeaderTextWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  background: #f1f5f9;
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
  margin-top: 4px;
`;

export const PersonalInfoCard = styled(MainCardHeaderless)`
  margin-top: 32px;
`;

export const AddressCard = styled(MainCardHeaderless)`
  margin-top: 32px;
`;
