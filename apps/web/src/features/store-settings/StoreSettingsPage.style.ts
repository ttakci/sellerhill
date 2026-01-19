import styled from '@emotion/styled';
import { Button, Card, Text, tkn } from '@repo/ui';

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: ${tkn('colors.text.secondary')};
`;

export const Container = styled.div`
  width: 100%;
  margin: 0 auto;
  padding: 0 ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
    gap: ${tkn('spacing.lg')};
  }
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-items: flex-start;
  
  /* Sticky Header Configuration */
  position: sticky;
  /* Use calc to safely negate the token */
  top: calc(-1 * ${tkn('spacing.md')});
  margin-top: calc(-1 * ${tkn('spacing.md')}); 
  
  z-index: 99;
  background-color: ${tkn('colors.background.secondary')};
  
  /* Expand to cover container padding horizontally */
  margin-left: calc(-1 * ${tkn('spacing.md')});
  margin-right: calc(-1 * ${tkn('spacing.md')});
  padding: ${tkn('spacing.md')};
  
  /* Visual separator */
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    
    /* Desktop pull up and stick */
    top: calc(-1 * ${tkn('spacing.xl')});
    margin-top: calc(-1 * ${tkn('spacing.xl')});
    
    /* Desktop expansion */
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

export const HeaderTitleWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const PageTitle = styled(Text)`
  font-size: 26px !important;
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

export const GlobalBanner = styled.div`
  background: ${tkn('colors.background.secondary')}; /* Use the Matte white */
  border: 1px solid ${tkn('colors.border.primary')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  box-sizing: border-box;
  box-shadow: ${tkn('shadows.sm')}; /* Add tiny shadow for depth */

  @media (min-width: 1024px) {
    padding: ${tkn('spacing.lg')};
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start; /* Align to top as requested */
  }
`;

export const SwitchGroup = styled.div`
  display: flex;
  align-items: flex-start; /* Top align toggle with text */
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 0;
`;

export const SwitchLabelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px; /* Tighter gap */
  margin-top: -4px; /* Visual alignment with toggle switch */
`;

export const DescriptionWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
`;

export const DescriptionLine = styled(Text)`
  line-height: 1.4 !important;
`;

export const SecondaryDescriptionLine = styled(Text)`
  font-size: 13px !important;
  line-height: 1.4 !important;
`;

export const StoreSelectWrapper = styled.div<{ $disabled?: boolean }>`
  width: 100%;
  max-width: 100%;
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  transition: opacity ${tkn('transitions.fast')};
  
  @media (min-width: 1024px) {
    max-width: 320px;
  }
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start; /* Align to top so icon aligns with title line */
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')}; /* Increased padding for breathing room */
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  
  /* Ensure consistent height/alignment */
  min-height: 4.5rem;
`;

export const SectionTitleGroup = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
`;

export const SectionTitleContent = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 2px;
`;

export const SectionTitle = styled(Text)`
  font-size: 1.125rem !important;
`;

export const HeaderIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: ${tkn('radius.lg')}; /* Squircle */
  background-color: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.text.primary')};
  flex-shrink: 0;
  
  /* Optional: Add subtle border */
  border: 1px solid ${tkn('colors.border.secondary')};
`;

export const AddressGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const GlobalGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  align-items: flex-start;
  gap: ${tkn('spacing.xl')};
  margin-top: ${tkn('spacing.xl')};

  @media (min-width: 1200px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const StoreLabel = styled.label`
  display: block;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
  margin-bottom: ${tkn('spacing.xs')};
`;

export const Copyright = styled.div`
  text-align: center;
  color: ${tkn('colors.text.tertiary')};
  font-size: 13px;
  padding: ${tkn('spacing.xl')} 0;
`;

export const BlacklistControls = styled.div`
  flex: 1;
  display: flex;
  justify-content: flex-end;
  margin-left: ${tkn('spacing.md')};
`;

export const BlacklistInputWrapper = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  padding: 2px;
  gap: ${tkn('spacing.xs')};
  width: 100%;
  max-width: 600px;
  
  &:focus-within {
    border-color: ${tkn('colors.border.focus')};
    box-shadow: 0 0 0 3px ${tkn('colors.brand.secondary')};
  }
`;

export const BlacklistInput = styled.input`
  border: none;
  background: transparent;
  outline: none;
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  padding: 0 ${tkn('spacing.md')};
  flex: 1;
  min-width: 100px;
  height: 44px;
`;

export const BlacklistActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  
  @media (max-width: 767px) {
    display: none; /* Hide on mobile to keep it simple or adjust layout */
  }
`;

export const BlacklistCard = styled(Card)`
  margin-top: 24px;
`;

export const AddButton = styled(Button)`
  height: 44px;
`;

export const BlacklistTitleColumn = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};
  align-items: flex-start;
`;

export const ScopeSelectContainer = styled.div`
  width: 10rem;
`;

export const IconAction = styled.button`
  background: none;
  border: none;
  color: ${tkn('colors.text.secondary')};
  cursor: pointer;
  padding: ${tkn('spacing.xs')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.sm')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.semantic.error')};
    background: ${tkn('colors.background.tertiary')};
  }
`;
