import styled from '@emotion/styled';
import {
  Card,
  EmptyState as EmptyStateMolecule,
  IconButton as IconButtonAtom,
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
export const CardBodyContent = styled.div`
  padding: ${tkn('spacing.lg')};
  min-height: 6.25rem; /* 100px */
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};

  @media (max-width: 63.9375rem) {
    /* 1023px */
    padding: ${tkn('spacing.md')};
  }
`;

export const CardTitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const CardTitleText = styled(Text)`
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
  gap: ${tkn('spacing.sm-md')}; /* 12px */
`;

export const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs+')}; /* 6px */
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.sm')}; /* 0.8125rem (13px) → sm (14px) closest */
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const CardActions = styled.div`
  display: flex;
  gap: ${tkn('spacing.xs')};
`;

export const IconButton = styled(IconButtonAtom)<{ $type?: 'delete' | 'edit' }>`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */

  &:hover {
    background: ${({ $type, theme }) =>
      $type === 'delete' ? theme.colors.semantic.error + '10' : theme.colors.background.tertiary};
    color: ${({ $type, theme }) => ($type === 'delete' ? theme.colors.semantic.error : theme.colors.brand.primary)};
  }
`;

/* refined and reordered below */
export const InteractiveCard = styled(Card)`
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  overflow: hidden;

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem); /* -2px */
  }

  &:hover .card-title {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const EmptyState = styled(EmptyStateMolecule)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.lg')};
`;

export const EmptyStateWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};
`;

export const EmptyStateContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  max-width: 25rem; /* 400px */
`;
