import styled from '@emotion/styled';
import { Badge, Card, Text, tkn } from '@repo/ui';

export const InteractiveCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>`
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem); /* -2px */
  }

  &:hover .card-title {
    color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  ${({ $selected, theme }) =>
    $selected
      ? `border-color: ${tkn('colors.brand.primary')({ theme })}; box-shadow: ${tkn('shadows.sm')({ theme })};`
      : ''}
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const CardName = styled(Text)`
  transition: color ${tkn('transitions.normal')};
  min-width: 0;
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};
  flex: 1;
`;

export const StatColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};
  margin-top: ${tkn('spacing.sm')};
`;

export const StatColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const StatColumnTitle = styled(Text)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
`;

export const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  & > span,
  & > p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const ActiveBadge = styled(Badge)`
  max-width: 11rem; /* 176px — long template names / "Customized Template" */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
`;
