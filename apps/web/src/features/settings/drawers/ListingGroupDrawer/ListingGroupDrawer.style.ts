import styled from '@emotion/styled';
import { Button, Card, CardBody, IconButton as IconButtonAtom, Text, Textarea, tkn } from '@repo/ui';

export const StepperWrapper = styled.div`
  margin-bottom: 0;
  background: ${tkn('colors.surface.primary')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  box-sizing: border-box;
`;

/**
 * Wizard step panel. Every step is mounted at once and only the active one is
 * shown; inactive steps are hidden with `display: none`. Keeping all steps
 * mounted is required because react-hook-form drops a controlled field's value
 * when its input unmounts — so unmounting a step on navigation silently
 * emptied step-0 fields (name, stock.defaultQuantity, ...) and the final
 * submit then failed validation with no feedback.
 */
export const StepPanel = styled.div<{ $active: boolean }>`
  display: ${({ $active }) => ($active ? 'block' : 'none')};
`;

export { FormCard } from '../shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const StepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const StepIconWrapper = styled.div<{ $type?: 'general' | 'deductions' | 'repricing' | 'template' }>`
  width: 2rem;
  height: 2rem;
  border-radius: ${tkn('radius.sm')};
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
      case 'deductions':
        return `
          background: ${theme.colors.semantic.error}15;
          color: ${theme.colors.semantic.error};
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
      default:
        return `
          background: ${theme.colors.background.tertiary};
          color: ${theme.colors.text.primary};
        `;
    }
  }}
`;

export const StepTitleContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  flex: 1;
`;

export const StepTitle = styled(Text)`
  margin: 0;
`;

/* ── Repricing Card-based Layout ── */

export const RepricingCardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const RepricingCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
  transition: box-shadow ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
  }
`;

export const RepricingCardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.surface.primary')};
`;

export const RepricingCardBody = styled.div`
  padding: ${tkn('spacing.lg')};
  background: ${tkn('colors.surface.primary')};
`;

export const RepricingFieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: 36rem) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const RemoveButton = styled(Button)`
  width: 1.75rem;
  height: 1.75rem;
  min-width: unset;
  min-height: unset;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  flex-shrink: 0;
`;

export const AddRangeRow = styled.div`
  display: flex;
  justify-content: center;
  padding-top: ${tkn('spacing.xs')};
`;

export const AddRangeButton = styled(Button)`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  width: 100%;
  justify-content: center;
  border-style: dashed;
`;

/* ── Template Step ── */

export const TemplateTypeToggle = styled.div`
  display: flex;
  background: ${tkn('colors.background.tertiary')};
  padding: ${tkn('spacing.xs')};
  border-radius: ${tkn('radius.lg')};
  gap: ${tkn('spacing.xs')};
`;

export const ToggleItem = styled(Button)<{ active?: boolean }>`
  background: ${({ active }) => (active ? tkn('colors.surface.primary') : 'transparent')};
  color: ${({ active }) => (active ? tkn('colors.brand.primary') : tkn('colors.text.secondary'))};
  box-shadow: ${({ active }) => (active ? tkn('shadows.sm') : 'none')};

  &:hover {
    color: ${(p) => p.theme.colors.brand.primary};
  }
`;

export const TemplateBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

/* Shared Textarea atom in mono mode. This was a forked native <textarea> with
   its own border/focus rules — so it never picked up the shared focus ring. */
export const CustomTemplateTextarea = styled(Textarea)`
  min-height: 12rem;
`;

export const PreviewContainer = styled.div`
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

export const PreviewViewport = styled.div`
  max-height: 30rem;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 0;

  &::-webkit-scrollbar {
    width: 0.375rem;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${tkn('colors.text.disabled')};
    border-radius: ${tkn('radius.md')};
  }
`;

export const PreviewContent = styled.div`
  width: 100%;
  background: ${tkn('colors.surface.primary')};
  min-height: 100%;
  transition: width ${tkn('transitions.normal')};
`;

export const PreviewHTMLContent = styled.div`
  width: 100%;
  height: 100%;
`;

export const DeviceControls = styled.div`
  display: flex;
  gap: ${tkn('spacing.xs')};
  align-items: center;
  margin-right: ${tkn('spacing.xs')};
`;

export const PreviewIconButton = styled(IconButtonAtom)<{ $active?: boolean }>`
  background: ${({ $active, theme }) => ($active ? theme.colors.background.tertiary : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : theme.colors.text.tertiary)};

  &:hover {
    background: ${(p) => p.theme.colors.background.tertiary};
    color: ${(p) => p.theme.colors.brand.primary};
  }
`;

export const PreviewCard = styled(Card)`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

export const PreviewCardBody = styled(CardBody)`
  padding: 0;
`;
