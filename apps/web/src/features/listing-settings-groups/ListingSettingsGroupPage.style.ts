import styled from '@emotion/styled';
import { Badge, Card, Text, tkn } from '@repo/ui';

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

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    /* 768px */
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 64rem) {
    /* 1024px */
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 80rem) {
    /* 1280px */
    grid-template-columns: repeat(4, 1fr);
  }
`;

/* refined and reordered below */
export const CardHeader = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */

  @media (max-width: 63.9375rem) {
    /* 1023px */
    padding: ${tkn('spacing.md')};
  }
`;

export const CardIconWrapper = styled.div`
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  border-radius: 0.625rem; /* 10px */
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};

  & svg {
    width: 1.5rem; /* 24px */
    height: 1.5rem; /* 24px */
  }
`;

export const CardBodyContent = styled.div`
  padding: ${tkn('spacing.lg')};
  min-height: 6.25rem; /* 100px */
  display: flex;
  flex-direction: column;
  gap: 1rem; /* 16px */

  @media (max-width: 63.9375rem) {
    /* 1023px */
    padding: ${tkn('spacing.md')};
  }
`;

export const CardTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */
`;

export const CardTitleText = styled(Text)`
  font-size: 1.125rem;
  font-weight: 700;
  transition: color ${tkn('transitions.normal')};
`;

export const CardFooter = styled.div`
  margin-top: auto;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.primary')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const Stats = styled.div`
  display: flex;
  gap: 0.75rem; /* 12px */
`;

export const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem; /* 6px */
  color: ${tkn('colors.text.tertiary')};
  font-size: 0.8125rem; /* 13px */
  font-weight: 500;
`;

export const CardActions = styled.div`
  display: flex;
  gap: 0.25rem; /* 4px */
`;

export const IconButton = styled.button<{ $type?: 'delete' | 'edit' }>`
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
  transition: all 0.2s;

  &:hover {
    background: ${({ $type, theme }) =>
      $type === 'delete' ? theme.colors.semantic.error + '10' : theme.colors.background.tertiary};
    color: ${({ $type, theme }) => ($type === 'delete' ? theme.colors.semantic.error : theme.colors.brand.primary)};
  }
`;

/* refined and reordered below */
export const ActiveBadge = styled(Badge)`
  font-weight: 700;
  font-size: 0.625rem; /* 10px */
  background-color: ${(p) => p.theme.colors.semantic.success}15 !important;
  color: ${(p) => p.theme.colors.semantic.success} !important;
  border: none;
`;

export const DashedCardIconWrapper = styled.div`
  width: 3rem; /* 48px */
  height: 3rem; /* 48px */
  border-radius: 50%;
  background: ${tkn('colors.background.secondary')}; /* #F8FAFC */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem; /* 4px */
  transition: background-color ${tkn('transitions.normal')};
`;

export const InteractiveCard = styled(Card)`
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  border-radius: ${tkn('radius.xl')} !important;
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem); /* -2px */
  }

  &:hover .card-title {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const DashedCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 12.5rem; /* 200px */
  background: transparent;
  border: 0.125rem dashed ${tkn('colors.border.secondary')}; /* 2px */
  border-radius: ${tkn('radius.xl')};
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  gap: 0.75rem; /* 12px */
  padding: ${tkn('spacing.xl')};
  color: ${tkn('colors.text.tertiary')};

  & svg {
    color: inherit;
    transition: color 0.15s;
  }

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    color: ${tkn('colors.brand.primary')};
  }

  &:hover .dashed-icon-wrapper {
    background: ${tkn('colors.brand.secondary')};
  }
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2.5rem; /* 80px 40px */
  text-align: center;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem dashed ${tkn('colors.border.primary')}; /* 1px */
  border-radius: 1rem; /* 16px */
  gap: 1.5rem; /* 24px */
  grid-column: 1 / -1;
`;

export const EmptyStateContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem; /* 8px */
  max-width: 25rem; /* 400px */
`;

export const Copyright = styled.div`
  padding: 2.5rem 0; /* 40px 0 */
  text-align: center;
  font-size: 0.8125rem; /* 13px */
  color: ${tkn('colors.text.tertiary')};
`;
