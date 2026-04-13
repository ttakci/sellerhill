import styled from '@emotion/styled';
import { Button, Text as UIText, Textarea as UITextarea, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

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
  gap: 0.75rem; /* 12px */
  margin-bottom: ${tkn('spacing.md')};

  h2 {
    font-size: 1rem; /* 16px */
    font-weight: 700;
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
  gap: 0.375rem; /* 6px */
  width: 100%;
`;

export const PolicyGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem; /* 24px */
  width: 100%;
`;

export const AsinCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
  margin-top: 1.5rem; /* 24px */
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
  gap: 0.75rem; /* 12px */
`;

export const AsinCounter = styled.div`
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primaryHover')};
  font-size: 0.75rem; /* 12px */
  font-weight: 700;
  padding: 0.375rem 0.75rem; /* 6px 12px */
  border-radius: 9999px;
`;

export const AsinInputWrapper = styled.div`
  padding: ${tkn('spacing.lg')};
`;

export const AsinInputHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem; /* 16px */
`;

export const AsinTextarea = styled(UITextarea)<{ hasError?: boolean }>`
  width: 100%;
  min-height: 15rem;
  box-sizing: border-box;
  resize: none;
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
  gap: 0.5rem;
`;

export const CancelButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const Label = styled(UIText)`
  display: block;
  margin-bottom: 0.375rem; /* 6px */
`;

export const RequiredStar = styled.span`
  color: ${tkn('colors.semantic.error')};
`;

export const ItalicHelp = styled(UIText)`
  font-style: italic;
  margin-top: 0.5rem; /* 8px */
`;

export const MonoCode = styled(UIText)`
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const AsinTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;
