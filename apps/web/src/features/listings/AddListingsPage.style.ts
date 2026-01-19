import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: 0 ${tkn('spacing.md')};
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
    gap: ${tkn('spacing.lg')};
  }
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const Breadcrumb = styled.nav`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};

  a {
    color: ${tkn('colors.text.secondary')};
    text-decoration: none;
    &:hover {
      color: ${tkn('colors.brand.primary')};
    }
  }

  span {
    color: ${tkn('colors.text.tertiary')};
  }

  strong {
    color: ${tkn('colors.text.primary')};
    font-weight: ${tkn('typography.fontWeight.bold')};
  }
`;

export const ConfigSection = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};

  @media (min-width: 768px) {
    padding: ${tkn('spacing.lg')};
  }
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const IconWrapper = styled.div`
  width: 32px;
  height: 32px;
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.brand.primary')}1A;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.brand.primary')};
`;

export const PolicyGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr 1fr;
  }
`;

export const AsinCard = styled(Card)`
  grid-column: 1 / -1;
`;

export const AsinCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
`;

export const AsinHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const AsinCounter = styled.div`
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.full')};
  border: 1px solid ${tkn('colors.border.primary')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.secondary')};

  span {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const AsinInputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const AsinInputHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const AsinTextarea = styled.textarea`
  width: 100%;
  min-height: 180px;
  max-height: 400px;
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.background.secondary')};
  color: ${tkn('colors.text.primary')};
  font-family: 'Courier New', monospace;
  font-size: ${tkn('typography.fontSize.sm')};
  resize: vertical;
  transition: all ${tkn('transitions.fast')};

  &:focus {
    outline: none;
    background: ${tkn('colors.surface.primary')};
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 4px ${tkn('colors.brand.primary')}1A;
  }

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const HelpText = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.xs')};
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} 0;
  
  @media (max-width: 767px) {
    flex-direction: column-reverse;
    button {
      width: 100%;
    }
  }
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;
