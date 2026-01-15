import styled from '@emotion/styled';
import { Button, tkn } from '@repo/ui';

export const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
`;

export const Header = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-end;
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;



export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
`;

export const GlobalBanner = styled.div`
  background: ${tkn('colors.background.primary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.lg')};
`;

export const SwitchGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 250px;
`;

export const SwitchLabelContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const StoreSelectWrapper = styled.div<{ $disabled?: boolean }>`
  width: 24rem;
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  transition: opacity ${tkn('transitions.fast')};
  
  @media (max-width: 768px) {
    width: 100%;
  }
`;

export const AddressGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.md')};
`;

export const GlobalGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: flex-start;
  gap: ${tkn('spacing.lg')};
  margin-top: ${tkn('spacing.xl')};
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
`;

export const BlacklistHeaderPanel = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.primary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
`;

export const BlacklistHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const BlacklistControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const BlacklistInputWrapper = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  padding: 4px; /* Tight padding for input group feel */
  gap: ${tkn('spacing.xs')};
  width: auto;
  min-width: 400px;
  
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
  min-width: 150px;
`;

export const BlacklistActionGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const BlacklistTitleColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const ScopeSelectContainer = styled.div`
  width: 10rem;
`;

export const AddButton = styled(Button)`
  padding: ${tkn('spacing.xs')};
`;

// Table Footer & Pagination replaced by TablePagination component

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
