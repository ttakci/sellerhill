import styled from '@emotion/styled';
import { Badge, Card, IconButton, Text, tkn } from '@repo/ui';

export const InteractiveCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>`
  cursor: pointer;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  transition: all ${tkn('transitions.normal')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  ${({ $selected, theme }) =>
    $selected
      ? `border-color: ${tkn('colors.brand.primary')({ theme })}; box-shadow: ${tkn('shadows.sm')({ theme })};`
      : ''}
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.lg')};
  flex: 1;
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const CardName = styled(Text)`
  flex: 1;
  min-width: 0;
  transition: color ${tkn('transitions.normal')};
`;

export const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  flex-shrink: 0;
`;

export const DefaultBadge = styled(Badge)`
  flex-shrink: 0;
`;

export const EventBadge = styled(Badge)`
  flex-shrink: 0;
`;

export const DeleteButton = styled(IconButton)`
  flex-shrink: 0;
`;

/** Full message body — the whole point of a bigger card is to read it without opening the editor. */
export const BodyPreview = styled(Text)`
  white-space: pre-wrap;
`;
