import styled from '@emotion/styled';

import { controlTokens } from '../../theme/designTokens';
import { tkn } from '../../theme/tkn';

export const Label = styled.label`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-height: ${controlTokens.height.medium};
  padding: 0 ${tkn('spacing.md')};
  outline: 0.0625rem dashed ${tkn('colors.border.control')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.primary')};
  cursor: pointer;

  &:focus-within {
    outline-color: ${tkn('colors.brand.primary')};
    box-shadow: none;
  }
`;

export const Input = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
`;

export const Copy = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;
