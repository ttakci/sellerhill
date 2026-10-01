import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/**
 * The whole row is the button — the same hit area the settings hub's
 * `SettingsActionRow` gives a navigation row, here for a section that opens
 * in place. Transparent on purpose: it sits inside a Card and must not add a
 * second surface.
 */
export const Row = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.25rem;
    border-radius: ${tkn('radius.sm')};
  }
`;

export const Info = styled.span`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
  flex: 1;
  min-width: 0;
`;

export const Chevron = styled.span<{ $isOpen: boolean }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: ${tkn('colors.text.secondary')};
  transition: transform ${tkn('transitions.fast')}, color ${tkn('transitions.fast')};
  transform: ${({ $isOpen }) => ($isOpen ? 'rotate(180deg)' : 'rotate(0deg)')};

  button:hover > & {
    color: ${tkn('colors.brand.primary')};
  }
`;
