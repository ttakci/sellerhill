import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Row = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  border: none;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
  transition: background-color ${tkn('transitions.fast')};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${tkn('colors.surface.secondary')};
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
  min-width: 0;
`;
