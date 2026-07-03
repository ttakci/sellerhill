import styled from '@emotion/styled';
import { IconButton as IconButtonAtom, StatusBadge as StatusBadgeMolecule, tkn } from '@repo/ui';

export const CardWrapper = styled.div`
  width: 100%;
`;

export const CardContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem; /* 12px — no exact token */
  min-height: 2.5rem; /* 40px */
`;

export const KeywordSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
`;

export const ScopeBadge = styled(StatusBadgeMolecule)`
  text-transform: uppercase;
  letter-spacing: 0.025em; /* no exact token (between wider=0.02em and widest=0.05em) */
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
