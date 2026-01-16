import styled from '@emotion/styled';
import { Button, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
 
  margin: 0 auto;    /* Centers precisely in the available space */
  padding: 0 ${tkn('spacing.md')}; /* Ensures equal gaps on both sides */
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

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
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
    align-items: center;
  }
`;

export const SwitchGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 0; /* Important for flex-shrink and text wrapping */
`;

export const SwitchLabelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const StoreSelectWrapper = styled.div<{ $disabled?: boolean }>`
  width: 100%;
  max-width: 100%;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  transition: opacity ${tkn('transitions.fast')};
  
  @media (min-width: 1024px) {
    max-width: 320px;
  }
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
  gap: ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.sm')};

  @media (min-width: 1200px) {
    grid-template-columns: 1fr 1fr;
    margin-top: ${tkn('spacing.lg')};
  }
`;

export const StoreLabel = styled.label`
  display: block;
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.secondary')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${tkn('spacing.sm')};
`;

export const Copyright = styled.div`
  text-align: center;
  color: ${tkn('colors.text.secondary')};
  font-size: 13px;
  padding: ${tkn('spacing.xl')} 0;
`;

// Blacklist Styling
export const BlacklistCard = styled.div`
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  overflow: hidden;
  margin-top: ${tkn('spacing.xl')};
  width: 100%;
`;

export const BlacklistHeaderPanel = styled.div`
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.background.primary')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

  @media (min-width: 1024px) {
    padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`;

export const BlacklistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${tkn('spacing.md')};
  width: 100%;

  @media (min-width: 1024px) {
    width: auto;
  }
`;

export const BlacklistControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  width: 100%;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  @media (min-width: 1024px) {
    width: auto;
  }
`;

export const BlacklistInputWrapper = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  padding: 2px 4px;
  gap: ${tkn('spacing.xs')};
  width: 100%;
  max-width: 500px;
  
  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 1px ${tkn('colors.brand.primary')};
  }
`;

export const BlacklistInput = styled.input`
  border: none;
  background: transparent;
  outline: none;
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  flex: 1;
  min-width: 100px;
`;

export const BlacklistActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
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

export const BlacklistTitleColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const ScopeSelectContainer = styled.div`
  width: 100%;
  @media (min-width: 768px) {
    width: 10rem;
  }
`;

export const AddButton = styled(Button)`
  padding: ${tkn('spacing.xs')};
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
  border-radius: ${tkn('radius.md')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.semantic.error')};
    background: ${tkn('colors.background.secondary')};
  }
`;
