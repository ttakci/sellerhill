import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  box-sizing: border-box;
  padding-bottom: 40px;
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0;

  @media (max-width: 767px) {
    flex-direction: column;
    gap: ${tkn('spacing.md')};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
`;

export const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  width: 100%;
`;

export const StyledCard = styled(Card)`
  border-radius: 16px !important;
  overflow: hidden;
  box-shadow: ${tkn('shadows.sm')};
`;

export const SectionHeader = styled.div`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  align-items: center;
  gap: 16px;
  background: #FFFFFF;
`;

export const HeaderIconWrapper = styled.div<{ $type?: 'general' | 'repricing' | 'template' | 'preview' | 'fees' }>`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${({ $type }) => {
    switch ($type) {
      case 'general':
        return `
          background: #EFF6FF;
          color: #2563EB;
        `;
      case 'repricing':
        return `
          background: #ECFDF5;
          color: #059669;
        `;
      case 'template':
        return `
          background: #FFF7ED;
          color: #EA580C;
        `;
      case 'preview':
        return `
          background: #ECFEFF;
          color: #0891B2;
        `;
      case 'fees':
        return `
          background: #F8FAFC;
          color: #64748B;
        `;
      default:
        return `
          background: ${tkn('colors.background.tertiary')};
          color: ${tkn('colors.text.primary')};
        `;
    }
  }}
`;

export const SectionTitleContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
`;

export const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const PaddingContainer = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
`;

export const InputGrid = styled.div<{ columns?: number }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(${({ columns }) => columns || 3}, 1fr);
  }
`;

export const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

export const InputLabel = styled.label`
  font-size: 11px;
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const PriceRangesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const PriceRangeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: #F8FAFC;
  border-radius: 12px;
  border: 1px solid ${tkn('colors.border.primary')};
  position: relative;
`;

export const RemoveButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #FEF2F2;
  color: #EF4444;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: #FEE2E2;
    transform: scale(1.05);
  }
`;

export const SplitGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;

  @media (max-width: 1199px) {
    grid-template-columns: 1fr;
  }
`;

export const TemplateSettingsCard = styled(Card)`
  display: flex;
  flex-direction: column;
  min-height: 500px;
  border-radius: 16px !important;
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
`;

export const TemplateTypeToggle = styled.div`
  display: flex;
  background: #F1F5F9;
  padding: 4px;
  border-radius: 8px;
  gap: 4px;
`;

export const ToggleItem = styled.button<{ active?: boolean }>`
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  background: ${({ active }) => (active ? '#FFFFFF' : 'transparent')};
  color: ${({ active }) => (active ? '#2563EB' : '#64748B')};
  font-weight: 700;
  font-size: 11px;
  cursor: pointer;
  box-shadow: ${({ active }) => (active ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none')};
  transition: all 0.2s;

  &:hover {
    color: ${({ active }) => (active ? '#2563EB' : '#1E293B')};
  }
`;

export const TemplateSelectorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
`;

export const TemplateEditorContainer = styled.div`
  flex: 1;
  background: #0F172A;
  border-radius: 12px;
  border: 1px solid #1E293B;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 350px;
`;

export const EditorCodeArea = styled.div`
  flex: 1;
  padding: 16px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #94A3B8;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 10px;
  }
`;

export const CustomTemplateTextarea = styled.textarea`
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  color: #CBD5E1;
  font-family: inherit;
  font-size: inherit;
  outline: none;
  resize: none;
  line-height: 1.6;
`;

export const PreviewCard = styled(Card)`
  display: flex;
  flex-direction: column;
  min-height: 500px;
  border-radius: 16px !important;
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
`;

export const DeviceControls = styled.div`
  display: flex;
  gap: 4px;
`;

export const IconButton = styled.button<{ $active?: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $active }) => ($active ? '#F1F5F9' : 'transparent')};
  color: ${({ $active }) => ($active ? '#2563EB' : '#94A3B8')};
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #F1F5F9;
    color: #2563EB;
  }
`;

export const PreviewContainer = styled.div`
  flex: 1;
  background: #F8FAFC;
  border-radius: 12px;
  border: 1px solid ${tkn('colors.border.primary')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

export const PreviewBrowserHeader = styled.div`
  height: 24px;
  background: #F1F5F9;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 4px;
`;

export const BrowserDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #CBD5E1;
`;

export const PreviewViewport = styled.div<{ $device: 'desktop' | 'tablet' | 'mobile' }>`
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: ${({ $device }) => ($device === 'desktop' ? '0' : '20px')};

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #CBD5E1;
    border-radius: 10px;
  }
`;

export const PreviewContent = styled.div<{ $width: string }>`
  width: ${({ $width }) => $width};
  background: #FFFFFF;
  min-height: 100%;
  transition: width 0.3s ease;
`;

export const PreviewHTMLContent = styled.div`
  width: 100%;
  height: 100%;
`;

export const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  color: #2563EB;
  font-size: 11px;
  font-weight: 700;
  background: transparent;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
  
  &:hover {
    text-decoration: underline;
  }
`;

export const StockInputWrapper = styled.div`
  /* Standard input group style */
`;
