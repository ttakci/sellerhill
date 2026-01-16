import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
`;

export const MainLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};

  @media (min-width: 1024px) {
    flex-direction: row;
    align-items: flex-start;
  }
`;

export const FormSections = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  min-width: 0;
`;

export const PreviewSidebar = styled.div`
  width: 100%;
  position: sticky;
  top: ${tkn('spacing.xl')};

  @media (min-width: 1024px) {
    width: 450px;
    flex-shrink: 0;
  }
`;

export const SectionCard = styled.div`
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  box-shadow: ${tkn('shadows.sm')};
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  background-color: ${tkn('colors.background.tertiary')};
`;

export const SectionContent = styled.div`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const InputGrid = styled.div<{ columns?: number }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: 768px) {
    grid-template-columns: repeat(${({ columns }) => columns ?? 2}, 1fr);
  }
`;

export const PriceRangeRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.background.tertiary')};
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
  background: ${tkn('colors.background.tertiary')};
  padding: 4px;
  border-radius: ${tkn('radius.md')};
  width: fit-content;
  margin-bottom: ${tkn('spacing.md')};
`;

export const ToggleItem = styled.button<{ active?: boolean }>`
  padding: 8px 16px;
  border-radius: ${tkn('radius.sm')};
  border: none;
  background: ${({ active }) => (active ? tkn('colors.background.secondary') : 'transparent')};
  color: ${({ active }) => (active ? tkn('colors.brand.primary') : tkn('colors.text.secondary'))};
  font-weight: ${({ active }) => (active ? 600 : 400) as any};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  box-shadow: ${({ active }) => (active ? tkn('shadows.sm') : 'none')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const PreviewContainer = styled.div`
  border-radius: ${tkn('radius.lg')};
  background: white;
  border: 1px solid ${tkn('colors.border.primary')};
  aspect-ratio: 3/4;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: ${tkn('shadows.md')};
`;

export const PreviewToolbar = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const PreviewFrame = styled.iframe`
  flex: 1;
  border: none;
  width: 100%;
  height: 100%;
`;

export const IconButton = styled.button<{ $active?: boolean }>`
  background: none;
  border: none;
  color: ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.text.secondary'))};
  cursor: pointer;
  padding: ${tkn('spacing.xs')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.sm')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
    background: ${tkn('colors.background.tertiary')};
  }
`;
