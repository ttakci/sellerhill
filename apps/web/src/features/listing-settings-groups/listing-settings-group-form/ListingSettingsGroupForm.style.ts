import styled from '@emotion/styled';
import {
  Button,
  Card,
  IconButton as IconButtonAtom,
  Text,
  Textarea,
  tkn,
} from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  box-sizing: border-box;
  padding-bottom: 2.5rem; /* 40px */
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0;

  @media (max-width: 47.9375rem) {
    /* 767px */
    flex-direction: column;
    gap: ${tkn('spacing.md')};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */
`;

export const PageTitle = styled(Text)`
  margin: 0;
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};

  @media (max-width: 47.9375rem) {
    /* 767px */
    width: 100%;

    & > button {
      flex: 1;
      justify-content: center;
    }
  }
`;

export const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  width: 100%;
`;

export const StyledCard = styled(Card)`
  overflow: hidden;
`;

export const SectionHeader = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  align-items: center;
  gap: 1rem; /* 16px */
  background: ${tkn('colors.surface.primary')};

  @media (max-width: 63.9375rem) {
    /* 1023px */
    padding: ${tkn('spacing.md')};
  }
`;

export const HeaderIconWrapper = styled.div<{ $type?: 'general' | 'repricing' | 'template' | 'preview' | 'fees' }>`
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  border-radius: 0.625rem; /* 10px */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${({ $type, theme }) => {
    switch ($type) {
      case 'general':
        return `
          background: ${theme.colors.brand.secondary};
          color: ${theme.colors.brand.primary};
        `;
      case 'repricing':
        return `
          background: ${theme.colors.semantic.success}15;
          color: ${theme.colors.semantic.success};
        `;
      case 'template':
        return `
          background: ${theme.colors.semantic.warning}15;
          color: ${theme.colors.semantic.warning};
        `;
      case 'preview':
        return `
          background: ${theme.colors.semantic.info}15;
          color: ${theme.colors.semantic.info};
        `;
      case 'fees':
        return `
          background: ${theme.colors.semantic.error}15;
          color: ${theme.colors.semantic.error};
        `;
      default:
        return `
          background: ${theme.colors.background.tertiary};
          color: ${theme.colors.text.primary};
        `;
    }
  }}
`;

export const SectionTitleContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem; /* 2px */
  flex: 1;
`;

export const SectionTitle = styled(Text)`
  margin: 0;
`;

export const PaddingContainer = styled.div<{ $flex?: boolean }>`
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  ${({ $flex }) => $flex && 'flex: 1;'}
`;

export const InputGrid = styled.div<{ columns?: number }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    /* 768px */
    grid-template-columns: repeat(${({ columns }) => columns || 3}, 1fr);
  }
`;

export const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem; /* 8px */
`;

export const InputLabel = styled(Text)``;

export const PriceRangesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem; /* 16px */
`;

export const PriceRangeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem; /* 16px */
  padding: ${tkn('spacing.lg')};
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  position: relative;

  @media (max-width: 63.9375rem) {
    /* 1023px */
    padding: ${tkn('spacing.md')};
  }
`;

export const RemoveButton = styled(Button)`
  position: absolute;
  top: 0.75rem; /* 12px */
  right: 0.75rem; /* 12px */
  width: 1.75rem; /* 28px */
  height: 1.75rem; /* 28px */
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const SplitGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: ${tkn('spacing.lg')};

  @media (max-width: 74.9375rem) {
    /* 1199px */
    grid-template-columns: 1fr;
  }
`;

export const TemplateSettingsCard = styled(Card)`
  display: flex;
  flex-direction: column;
  min-height: 31.25rem; /* 500px */
  overflow: hidden;
`;

export const TemplateTypeToggle = styled.div`
  display: flex;
  background: ${tkn('colors.background.tertiary')};
  padding: 0.25rem; /* 4px */
  border-radius: 0.5rem; /* 8px */
  gap: 0.25rem; /* 4px */
`;

export const ToggleItem = styled(Button)<{ active?: boolean }>`
  background: ${({ active }) => (active ? tkn('colors.surface.primary') : 'transparent')};
  color: ${({ active }) => (active ? tkn('colors.brand.primary') : tkn('colors.text.secondary'))};
  box-shadow: ${({ active }) => (active ? tkn('shadows.sm') : 'none')};

  &:hover {
    color: ${(p) => p.theme.colors.brand.primary};
  }
`;

export const TemplateSelectorWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem; /* 8px */
  margin-bottom: 1rem; /* 16px */
  width: 100%;
  max-width: 25rem; /* 400px */

  @media (max-width: 47.9375rem) {
    /* 767px */
    max-width: 100%;
  }
`;

export const TemplateEditorContainer = styled.div`
  flex: 1;
  background: #0f172a;
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid #1e293b; /* 1px */
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 21.875rem; /* 350px */
`;

export const EditorCodeArea = styled.div`
  flex: 1;
  padding: 1rem; /* 16px */
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.8125rem; /* 13px */
  color: #94a3b8;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 0.375rem; /* 6px */
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 0.625rem; /* 10px */
  }
`;

export const EditorComment = styled.div`
  color: #64748b;
  margin-bottom: 0.5rem;
  font-size: 0.6875rem;
`;

export const CustomTemplateTextarea = styled(Textarea)`
  width: 100%;
  height: 100%;
  resize: none;
  line-height: 1.6;
`;

export const PreviewCard = styled(Card)`
  display: flex;
  flex-direction: column;
  min-height: 31.25rem; /* 500px */
  overflow: hidden;
`;

export const DeviceControls = styled.div`
  display: flex;
  gap: 0.25rem; /* 4px */
`;

export const IconButton = styled(IconButtonAtom)<{ $active?: boolean }>`
  background: ${({ $active, theme }) => ($active ? theme.colors.background.tertiary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : theme.colors.text.tertiary)};

  &:hover {
    background: ${(p) => p.theme.colors.background.tertiary};
    color: ${(p) => p.theme.colors.brand.primary};
  }
`;

export const PreviewContainer = styled.div`
  flex: 1;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

export const PreviewBrowserHeader = styled.div`
  height: 1.5rem; /* 24px */
  background: ${(p) => p.theme.colors.background.tertiary};
  border-bottom: 0.0625rem solid ${(p) => p.theme.colors.border.primary}; /* 1px */
  display: flex;
  align-items: center;
  padding: 0 0.75rem; /* 12px */
  gap: 0.25rem; /* 4px */
`;

export const BrowserDot = styled.div`
  width: 0.375rem; /* 6px */
  height: 0.375rem; /* 6px */
  border-radius: 50%;
  background: #cbd5e1;
`;

export const PreviewViewport = styled.div<{ $device: 'desktop' | 'tablet' | 'mobile' }>`
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: ${({ $device }) => ($device === 'desktop' ? '0' : '1.25rem')}; /* 20px */

  &::-webkit-scrollbar {
    width: 0.375rem; /* 6px */
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 0.625rem; /* 10px */
  }
`;

export const PreviewContent = styled.div<{ $width: string }>`
  width: ${({ $width }) => $width};
  background: ${tkn('colors.surface.primary')};
  min-height: 100%;
  transition: width 0.3s ease;
`;

export const PreviewHTMLContent = styled.div`
  width: 100%;
  height: 100%;
`;

export const AddButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: 0.25rem; /* 4px */

  &:hover {
    color: ${(p) => p.theme.colors.brand.primaryHover};
    text-decoration: underline;
  }
`;

export const StockInputWrapper = styled.div`
  /* Standard input group style */
`;
