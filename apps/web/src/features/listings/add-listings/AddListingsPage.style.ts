import styled from '@emotion/styled';
import { Button, PageContainer, Text as UIText, Textarea as UITextarea, tkn } from '@repo/ui';

export const Container = PageContainer;

export const ConfigSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  margin-bottom: ${tkn('spacing.lg')};
  width: 100%;

  @media (min-width: 75rem) {
    /* 1200px */
    flex-direction: row;
    align-items: stretch;

    & > * {
      flex: 1;
      min-width: 0;
    }
  }
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  box-shadow: ${tkn('shadows.sm')};
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden; /* Prevent child overflow */
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')}; /* 12px */
  margin-bottom: ${tkn('spacing.md')};

  h2 {
    font-size: ${tkn('typography.fontSize.md')};
    font-weight: ${tkn('typography.fontWeight.bold')};
    color: ${tkn('colors.text.primary')};
    margin: 0;
  }
`;

export const IconWrapper = styled.div`
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  /* Ensure the icon itself is visible and centered */
  svg {
    width: 1.5rem; /* 24px */
    height: 1.5rem; /* 24px */
    display: block;
  }
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs+')}; /* 6px */
  width: 100%;
`;

export const PolicyGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  width: 100%;
`;

export const AsinCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
  margin-top: ${tkn('spacing.lg')};
  width: 100%;
`;

export const AsinCardHeader = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${tkn('colors.background.tertiary')};
`;

export const AsinHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')}; /* 12px */
`;

export const AsinCounter = styled.div`
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primaryHover')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  padding: ${tkn('spacing.xs+')} ${tkn('spacing.sm-md')}; /* 6px 12px */
  border-radius: ${tkn('radius.sm')};
`;

export const AsinInputWrapper = styled.div`
  padding: ${tkn('spacing.lg')};
`;

export const AsinInputHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${tkn('spacing.md')};
`;

export const AsinTextarea = styled(UITextarea)<{ hasError?: boolean }>`
  width: 100%;
  min-height: 15rem;
  box-sizing: border-box;
  resize: none;
`;

export const DraftOption = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: 0 ${tkn('spacing.lg')} ${tkn('spacing.md')};
`;

export const FormFooter = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.tertiary')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
`;

export const SubmitButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const CancelButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const Label = styled(UIText)`
  display: block;
  margin-bottom: ${tkn('spacing.xs+')}; /* 6px */
`;

export const RequiredStar = styled.span`
  color: ${tkn('colors.semantic.error')};
`;

export const ItalicHelp = styled(UIText)`
  font-style: italic;
  margin-top: ${tkn('spacing.sm')};
`;

export const MonoCode = styled(UIText)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
`;

export const AsinTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;
