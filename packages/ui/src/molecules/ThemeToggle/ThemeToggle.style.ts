import styled from '@emotion/styled';

export const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;

  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */

  background: ${({ theme }) => theme.colors.surface.secondary};
  border: 0.0625rem solid ${({ theme }) => theme.colors.border.primary}; /* 1px */
  border-radius: ${({ theme }) => theme.radius.md};

  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};

  color: ${({ theme }) => theme.colors.text.primary};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.primary};
    border-color: ${({ theme }) => theme.colors.border.focus};
    transform: translateY(-0.125rem); /* 2px */
  }

  &:focus-visible {
    outline: 0.125rem solid ${({ theme }) => theme.colors.border.focus}; /* 2px */
    outline-offset: 0.125rem; /* 2px */
  }

  &:active {
    transform: translateY(0);
  }
`;
