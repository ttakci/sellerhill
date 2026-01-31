import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const CardWrapper = styled.div`
  width: 100%;
`;

export const CardContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem; /* 12px */
  min-height: 2.5rem; /* 40px */
`;

export const KeywordSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
`;

export const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: ${tkn('radius.sm')};
  background: transparent;
  border: none;
  color: ${tkn('colors.text.tertiary')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  flex-shrink: 0;

  &:hover {
    background: ${tkn('colors.semantic.error')}15;
    color: ${tkn('colors.semantic.error')};
  }

  &:active {
    transform: scale(0.95);
  }
`;
