import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/** Wraps the trailing arrow so it can nudge on row hover (no background change). */
export const Arrow = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  transition: transform ${tkn('transitions.fast')};
`;

export const Row = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  /* No horizontal padding: the icon left-edge aligns with the card header via the
     parent CardBody padding. Vertical padding keeps the touch target. */
  padding: ${tkn('spacing.md')} 0;
  border: none;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:last-child {
    border-bottom: none;
  }

  &:hover > :last-child {
    transform: translateX(0.125rem); /* 2px nudge — background stays put */
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
  }
`;

export const Info = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  flex: 1;
  min-width: 0;
`;

/** Vertically stacked title + subtitle. */
export const TextStack = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;
