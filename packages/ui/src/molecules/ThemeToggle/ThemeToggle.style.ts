import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const ToggleButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;

  width: 2.125rem; /* 34px — matches the LanguageSwitcher track height */
  height: 2.125rem;

  background: color-mix(in srgb, ${tkn('colors.surface.primary')} 55%, transparent);
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  backdrop-filter: blur(8px);

  color: ${tkn('colors.text.secondary')};
  cursor: pointer;
  transition:
    background 150ms ease,
    color 150ms ease,
    border-color 150ms ease;

  &:hover {
    color: ${tkn('colors.text.primary')};
    border-color: ${tkn('colors.border.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.border.focus')};
    outline-offset: 0.125rem;
  }
`;
