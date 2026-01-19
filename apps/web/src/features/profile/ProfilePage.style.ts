import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: 0 ${tkn('spacing.md')};

  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
  }
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${tkn('spacing.md')};
`;

export const BreadcrumbList = styled.nav`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.sm')};

  span {
    color: ${tkn('colors.text.tertiary')};
  }

  a {
    color: ${tkn('colors.text.secondary')};
    text-decoration: none;
    font-weight: ${tkn('typography.fontWeight.medium')};
    &:hover {
      color: ${tkn('colors.brand.primary')};
    }
  }

  strong {
    color: ${tkn('colors.text.primary')};
    font-weight: ${tkn('typography.fontWeight.semibold')};
  }
`;

export const PageTitle = styled.div`
  padding: ${tkn('spacing.md')} 0;
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
