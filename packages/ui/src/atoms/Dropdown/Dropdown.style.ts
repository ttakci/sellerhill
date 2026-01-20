import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  position: relative;
  display: block;
  width: 100%;
`;

export const Menu = styled.div<{ $isOpen: boolean; $align: 'left' | 'right'; $direction?: 'up' | 'down'; $width?: string }>`
  position: absolute;
  ${({ $direction }) => ($direction === 'up' ? 'bottom: 120%;' : 'top: 120%;')}
  ${({ $align }) => ($align === 'left' ? 'left: 0;' : 'right: 0;')};
  z-index: 1000;
  display: ${({ $isOpen }) => ($isOpen ? 'flex' : 'none')};
  flex-direction: column;
  ${({ $width }) => ($width ? `width: ${$width}; min-width: unset;` : 'min-width: 260px;')};
  background: ${tkn('colors.background.secondary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  padding: 8px 0; /* Restored padding */
  box-shadow: ${tkn('shadows.xl')};
  animation: ${({ $direction }) => ($direction === 'up' ? 'fadeInUp' : 'fadeIn')} 0.2s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export const DropdownHeader = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  margin-bottom: 8px;
`;

export const MenuItem = styled.button<{ $variant?: 'default' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px; /* Reduced horizontal bulge */
  border: none;
  background: transparent;
  cursor: pointer;
  
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  transition: all 0.2s;
  color: ${({ $variant, theme }) => 
    $variant === 'danger' ? theme.colors.semantic.error : theme.colors.text.primary};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
    color: ${({ $variant, theme }) => 
      $variant === 'danger' ? theme.colors.semantic.error : theme.colors.brand.primary};
  }
`;
