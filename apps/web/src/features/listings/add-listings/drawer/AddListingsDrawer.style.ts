import styled from '@emotion/styled';
import { Text as UIText, Textarea as UITextarea, tkn } from '@repo/ui';

export const StepperWrapper = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
`;

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
`;

export const IconWrapper = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const PolicyGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
`;

export const AsinInputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const AsinCounter = styled.div`
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primaryHover')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  padding: ${tkn('spacing.xs+')} ${tkn('spacing.sm-md')};
  border-radius: ${tkn('radius.sm')};
`;

export const AsinTextarea = styled(UITextarea)<{ hasError?: boolean }>`
  width: 100%;
  min-height: 12rem;
  box-sizing: border-box;
  resize: none;
`;

export const Label = styled(UIText)`
  display: block;
  margin-bottom: ${tkn('spacing.xs+')};
`;

export const RequiredStar = styled.span`
  color: ${tkn('colors.semantic.error')};
`;
