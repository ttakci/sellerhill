import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 80rem; /* 1280px */
  margin: 0 auto;
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #f9fafb;
`;

export const Header = styled.div`
  margin-bottom: ${tkn('spacing.lg')};

  h1 {
    font-size: 1.5rem; /* 24px */
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 0.25rem; /* 4px */
  }

  p {
    font-size: 0.875rem; /* 14px */
    color: #64748b;
    max-width: 48rem; /* 768px */
    line-height: 1.5;
  }
`;

export const ConfigSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  margin-bottom: ${tkn('spacing.lg')};

  @media (min-width: 64rem) {
    /* 1024px */
    flex-direction: row;
    align-items: stretch;

    & > * {
      flex: 1;
      min-width: 0;
    }
  }
`;

export const Card = styled.div`
  background: white;
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};

  border: 0.0625rem solid #e5e7eb; /* 1px */
  box-shadow: 0 0.0625rem 0.125rem 0 rgba(0, 0, 0, 0.05); /* 1px 2px */
  display: flex;
  flex-direction: column;
  height: 100%;
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */
  margin-bottom: ${tkn('spacing.md')};

  h2 {
    font-size: 1rem; /* 16px */
    font-weight: 700;
    color: #1e293b;
    margin: 0;
  }
`;

export const IconWrapper = styled.div`
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  background: #eff6ff;
  color: #2563eb;
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
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem; /* 16px */
  width: 100%;

  @media (min-width: 40rem) {
    /* 640px */
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const AsinCard = styled.div`
  background: white;
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid #e5e7eb; /* 1px */
  box-shadow: 0 0.0625rem 0.125rem 0 rgba(0, 0, 0, 0.05); /* 1px 2px */
  overflow: hidden;
  margin-top: 1.5rem; /* 24px */
  width: 100%;
`;

export const AsinCardHeader = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid #e5e7eb; /* 1px */
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(248, 250, 252, 0.5);
`;

export const AsinHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */
`;

export const AsinCounter = styled.div`
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 0.75rem; /* 12px */
  font-weight: 700;
  padding: 0.375rem 0.75rem; /* 6px 12px */
  border-radius: 624.9375rem; /* 9999px */
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

export const AsinTextarea = styled.textarea<{ hasError?: boolean }>`
  width: 100%;
  min-height: 15rem; /* 240px */
  background: #f9fafb;
  border: 0.0625rem solid ${({ hasError }) => (hasError ? '#ef4444' : '#e5e7eb')}; /* 1px */
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.lg')};

  font-family: 'JetBrains Mono', monospace;
  font-size: 0.875rem; /* 14px */
  color: #475569;
  line-height: 1.5;
  outline: none;
  resize: none;
  transition: all 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 0.125rem rgba(37, 99, 235, 0.1); /* 2px */
    background: white;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

export const FormFooter = styled.div`
  padding: 1rem 1.5rem; /* 16px 24px */
  background: rgba(248, 250, 252, 0.3);
  border-top: 0.0625rem solid #e5e7eb; /* 1px */
  display: flex;
  justify-content: flex-end;
`;

export const SubmitButton = styled.button`
  background: #2563eb;
  color: white;
  font-size: 0.875rem; /* 14px */
  font-weight: 600;
  padding: 0.625rem 2rem; /* 10px 32px */
  border-radius: 0.5rem; /* 8px */
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
  transition: all 0.2s;
  box-shadow: 0 0.0625rem 0.125rem 0 rgba(0, 0, 0, 0.05); /* 1px 2px */

  &:hover:not(:disabled) {
    background: #1d4ed8;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const Label = styled.label`
  display: block;
  font-size: 0.8125rem; /* 13px */
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.375rem; /* 6px */
`;

export const RequiredStar = styled.span`
  color: #ef4444;
`;

export const ItalicHelp = styled.p`
  font-size: 0.75rem; /* 12px */
  color: #94a3b8;
  font-style: italic;
  margin-top: 0.5rem; /* 8px */
`;

export const MonoCode = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem; /* 11px */
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;
