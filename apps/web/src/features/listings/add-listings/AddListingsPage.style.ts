import styled from '@emotion/styled';

export const Container = styled.div`
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: #f9fafb;
`;

export const Header = styled.div`
  margin-bottom: 32px;

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 4px;
  }

  p {
    font-size: 14px;
    color: #64748b;
    max-width: 768px;
    line-height: 1.5;
  }
`;

export const ConfigSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 24px;

  @media (min-width: 1024px) {
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
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  height: 100%;
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;

  h2 {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
  }
`;

export const IconWrapper = styled.div`
  width: 40px;
  height: 40px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  /* Ensure the icon itself is visible and centered */
  svg {
    width: 24px;
    height: 24px;
    display: block;
  }
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
`;

export const PolicyGrid = styled.div`
  display: grid;
  grid-template-cols: 1fr;
  gap: 16px;
  width: 100%;

  @media (min-width: 640px) {
    grid-template-cols: repeat(3, 1fr);
  }
`;

export const AsinCard = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  overflow: hidden;
  margin-top: 24px;
  width: 100%;
`;

export const AsinCardHeader = styled.div`
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(248, 250, 252, 0.5);
`;

export const AsinHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const AsinCounter = styled.div`
  background: #dbeafe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 9999px;
`;

export const AsinInputWrapper = styled.div`
  padding: 24px;
`;

export const AsinInputHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

export const AsinTextarea = styled.textarea<{ hasError?: boolean }>`
  width: 100%;
  min-height: 240px;
  background: #f9fafb;
  border: 1px solid ${({ hasError }) => hasError ? '#ef4444' : '#e5e7eb'};
  border-radius: 12px;
  padding: 24px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #475569;
  line-height: 1.5;
  outline: none;
  resize: none;
  transition: all 0.2s;
  box-sizing: border-box;

  &:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
    background: white;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

export const FormFooter = styled.div`
  padding: 16px 24px;
  background: rgba(248, 250, 252, 0.3);
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
`;

export const SubmitButton = styled.button`
  background: #2563eb;
  color: white;
  font-size: 14px;
  font-weight: 600;
  padding: 10px 32px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

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
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 6px;
`;

export const RequiredStar = styled.span`
  color: #ef4444;
`;

export const ItalicHelp = styled.p`
  font-size: 12px;
  color: #94a3b8;
  font-style: italic;
  margin-top: 8px;
`;

export const MonoCode = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;
