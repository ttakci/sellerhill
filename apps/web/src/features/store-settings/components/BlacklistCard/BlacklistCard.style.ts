import styled from '@emotion/styled';
import { IconButton as IconButtonAtom, tkn } from '@repo/ui';

export const CardWrapper = styled.div<{ $selectable?: boolean }>`
  background: ${tkn('colors.surface.primary')};
  /* Light border at rest; turns brand-blue on hover, matching the job /
     listing card pattern. */
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  box-sizing: border-box;
  width: 100%;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')};
  cursor: ${({ $selectable }) => ($selectable ? 'pointer' : 'default')};
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: ${tkn('shadows.md')};
  }
`;

/** Header row: keyword (left, card title) + delete action (right). */
export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1 1 auto;
`;

/** Body row: the fields this keyword is checked against, below the header. */
export const CardBody = styled.div`
  margin-top: ${tkn('spacing.sm')};
`;

export const CheckboxSection = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

export const KeywordSection = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;

  > span,
  > p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const ScopeSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const ScopeTag = styled.div<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.background.tertiary')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  white-space: normal;
  max-width: 100%;
  overflow-wrap: anywhere;
`;

export const ActionButton = styled(IconButtonAtom)`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  flex-shrink: 0;

  &:hover {
    background: ${tkn('colors.semantic.error')}15;
    color: ${tkn('colors.semantic.error')};
  }

  &:active {
    transform: scale(0.95);
  }
`;
