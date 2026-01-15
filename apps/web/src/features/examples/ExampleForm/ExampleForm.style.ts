import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  max-width: 600px;
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const InputWrapper = styled.div`
  position: relative;
`;

export const ErrorMessage = styled.span`
  color: ${tkn('colors.semantic.error')};
  font-size: ${tkn('typography.fontSize.sm')};
  margin-top: ${tkn('spacing.xs')};
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
`;

export const HelperText = styled.span`
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.sm')};
  margin-top: ${tkn('spacing.xs')};
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};
  justify-content: flex-start;
  padding-top: ${tkn('spacing.md')};
  border-top: 1px solid ${tkn('colors.border.primary')};
`;
