import styled from '@emotion/styled';
import { Button, Card, CardBody, Text, tkn } from '@repo/ui';

// ... existing imports

// --- New Components replacing inline styles ---

export const HeaderTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const EditorTitle = styled(Text)`
  font-size: 26px !important;
`;

export const SectionTitleText = styled.div`
  display: flex;
  flex-direction: column;
`;

export const StockInputWrapper = styled.div`
  max-width: 150px;
`;

export const PriceRangesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const TemplateSelectorWrapper = styled.div`
  padding: 16px 24px;
`;

export const CustomTemplateTextarea = styled.textarea`
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  outline: none;
  resize: none;
  display: block;
  padding: 16px; /* Added padding here to match usage */
`;

export const PredefinedTemplateWrapper = styled.div`
  padding: 0;
  height: 100%;
`;

export const PreviewCardContent = styled.div`
  padding: 0 24px 24px 24px;
  height: 100%;
`;

export const PreviewViewport = styled.div<{ device: 'desktop' | 'tablet' | 'mobile' }>`
  flex: 1;
  background: ${tkn('colors.background.tertiary')};
  padding: ${({ device }) => (device === 'desktop' ? '0' : '24px')};
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: ${({ device }) => (device === 'desktop' ? 'stretch' : 'flex-start')};
  /* Removed redundant border and radius here, as it's handled by PreviewContainer */
  position: relative;
`;

export const PreviewContent = styled.div<{ width: string; device: 'desktop' | 'tablet' | 'mobile' }>`
  width: ${({ width }) => width};
  height: 100%;
  background: white;
  box-shadow: ${({ device }) => (device !== 'desktop' ? tkn('shadows.lg') : 'none')};
  overflow-y: auto;
  transition: width 0.3s ease;
  border-radius: ${({ device }) => (device !== 'desktop' ? '12px' : '0')};
  border: ${({ device }) => (device !== 'desktop' ? `1px solid ${tkn('colors.border.primary')}` : 'none')};
`;

export const PreviewHTMLContent = styled.div`
  width: 100%;
  height: 100%;
`;

export const TemplateContent = styled.div`
  width: 100%;
  height: 100%;
`;

// --- Existing Components ---

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  padding: 0 ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
  }
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-items: flex-start;
  
  /* Sticky Header Configuration */
  position: sticky;
  top: calc(-1 * ${tkn('spacing.md')});
  margin-top: calc(-1 * ${tkn('spacing.md')}); 
  z-index: 99;
  background-color: ${tkn('colors.background.secondary')};
  
  margin-left: calc(-1 * ${tkn('spacing.md')});
  margin-right: calc(-1 * ${tkn('spacing.md')});
  padding: ${tkn('spacing.md')};
  
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    
    top: calc(-1 * ${tkn('spacing.xl')});
    margin-top: calc(-1 * ${tkn('spacing.xl')});
    margin-left: calc(-1 * ${tkn('spacing.xl')});
    margin-right: calc(-1 * ${tkn('spacing.xl')});
    padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  width: 100%;

  @media (min-width: 768px) {
    width: auto;
  }
  
  button {
    flex: 1;
    @media (min-width: 768px) {
      flex: none;
    }
  }
`;

export const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  width: 100%;
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
`;

export const LivePreviewHeader = styled(SectionHeader)`
  align-items: center;
`;

export const HeaderIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.brand.primary')};
`;

export const SectionTitleWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const SplitGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.xl')};
  align-items: stretch;

  @media (min-width: 1200px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const DeviceControls = styled.div`
  display: flex;
  background-color: ${tkn('colors.background.secondary')};
  padding: 4px;
  border-radius: 8px;
  gap: 4px;
  border: 1px solid ${tkn('colors.border.secondary')};
`;

export const InputGrid = styled.div<{ columns?: number }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};
  
  @media (min-width: 768px) {
     grid-template-columns: repeat(${({ columns }) => columns ?? 2}, 1fr);
  }
`;

export const PriceRangeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.secondary')};
  position: relative;
`;

export const RemoveButton = styled.button`
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${tkn('colors.semantic.error')};
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: ${tkn('shadows.sm')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    transform: scale(1.1);
    filter: brightness(1.1);
  }
`;

export const TemplateTypeToggle = styled.div`
  display: flex;
  background-color: ${tkn('colors.background.secondary')};
  padding: 4px;
  border-radius: 8px;
  width: fit-content;
  border: 1px solid ${tkn('colors.border.secondary')};
`;

export const ToggleItem = styled.button<{ active?: boolean }>`
  padding: 6px 20px;
  border-radius: 6px;
  border: none;
  background: ${({ active }) => (active ? tkn('colors.brand.primary') : 'transparent')};
  color: ${({ active }) => (active ? tkn('colors.text.inverse') : tkn('colors.text.secondary'))};
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
  
  &:hover {
    color: ${({ active }) => (active ? tkn('colors.text.inverse') : tkn('colors.text.primary'))};
  }
`;

export const PreviewContainer = styled.div`
  background-color: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.border.secondary')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%; 
`;

export const IconButton = styled.button<{ $active?: boolean }>`
  background: ${({ $active }) => ($active ? tkn('colors.surface.primary') : 'transparent')};
  border: none;
  color: ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.text.tertiary'))};
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all ${tkn('transitions.fast')};
  box-shadow: ${({ $active }) => ($active ? tkn('shadows.sm') : 'none')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
    background: ${({ $active }) => ($active ? tkn('colors.surface.primary') : tkn('colors.background.tertiary'))};
  }
`;

export const TemplateEditorContainer = styled.div`
  background-color: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.border.secondary')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin: 0 24px 24px 24px;
  flex: 1;
  min-height: 500px; /* Increased from 400px */
  display: flex;
  flex-direction: column;
`;

export const StyledCardBody = styled(CardBody)`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding-top: 0 !important; /* Selector wrapper has its own padding */
`;

export const AddButton = styled(Button)`
  padding-left: 12px;
  padding-right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  
  /* Modern clean look like store settings */
  height: 38px;
  border-radius: ${tkn('radius.md')};
`;

export const TemplateSettingsCard = styled(Card)`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

export const PreviewCard = styled(Card)`
  height: 100%;
`;

export const TemplateLabel = styled(Text)`
  margin-bottom: 8px;
  display: block;
`;

export const EditorCodeArea = styled.div`
  font-family: ${tkn('typography.fontFamily.mono')};
  font-size: 0.8125rem;
  color: ${tkn('colors.text.secondary')};
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const StockControlContainer = styled.div`
  /* Merged into general card, might not need specific container if just input grid */
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const StockRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.lg')};
`;

export const StockInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;
