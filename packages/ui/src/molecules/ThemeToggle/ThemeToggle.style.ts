import styled from '@emotion/styled';

export const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;

  width: 40px;
  height: 40px;

  background: ${({ theme }) => theme.colors.surface.secondary};
  border: 1px solid ${({ theme }) => theme.colors.border.primary};
  border-radius: ${({ theme }) => theme.radius.md};

  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.normal};

  color: ${({ theme }) => theme.colors.text.primary};

  &:hover {
    background: ${({ theme }) => theme.colors.surface.primary};
    border-color: ${({ theme }) => theme.colors.border.focus};
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.border.focus};
    outline-offset: 2px;
  }

  &:active {
    transform: translateY(0);
  }
`;
