import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/**
 * LayoutWrapper - Root container
 */
export const LayoutWrapper = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: ${tkn('colors.background.primary')};
`;

/**
 * SidebarContainer - Theme aware and responsive
 */
export const SidebarContainer = styled.aside<{ $isCollapsed: boolean; $isMobileOpen: boolean }>`
  width: ${(props) => (props.$isCollapsed ? tkn('spacing.xxxl') : '280px')};
  background: ${tkn('colors.background.secondary')};
  color: ${tkn('colors.text.primary')};
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  border-right: 1px solid ${tkn('colors.border.primary')};
  flex-shrink: 0;

  @media (max-width: 1023px) {
    position: fixed;
    top: 0;
    left: ${({ $isMobileOpen }) => ($isMobileOpen ? '0' : '-280px')};
    height: 100vh;
    width: 280px;
    box-shadow: ${tkn('shadows.xl')};
  }
`;

/**
 * Overlay for mobile sidebar
 */
export const SidebarOverlay = styled.div<{ $isOpen: boolean }>`
  display: none;
  
  @media (max-width: 1023px) {
    display: ${({ $isOpen }) => ($isOpen ? 'block' : 'none')};
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: ${tkn('colors.surface.overlay')};
    backdrop-filter: blur(4px);
    z-index: 999;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const LogoArea = styled.div<{ $isCollapsed: boolean }>`
  height: ${tkn('spacing.xxxl')};
  padding: 0 ${tkn('spacing.lg')};
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'flex-start')};
  gap: ${tkn('spacing.sm')};
  cursor: pointer;
  transition: opacity ${tkn('transitions.fast')};

  &:hover {
    opacity: 0.8;
  }
`;

export const LogoBox = styled.div`
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};
  background: ${tkn('colors.brand.primary')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: ${tkn('shadows.md')};
`;

export const NavSection = styled.nav`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.md')};
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: ${tkn('colors.border.secondary')}; border-radius: ${tkn('radius.full')}; }
`;

export const NavLabelWrapper = styled.div<{ $isCollapsed: boolean }>`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.sm')} ${tkn('spacing.xs')};
  display: ${({ $isCollapsed }) => ($isCollapsed ? 'none' : 'block')};
  text-transform: uppercase;
  user-select: none;
`;

export const NavItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export const NavItem = styled.div<{ $active?: boolean; $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'space-between')};
  padding: ${tkn('spacing.sm')} ${({ $isCollapsed }) => ($isCollapsed ? '0' : tkn('spacing.sm'))};
  border-radius: ${tkn('radius.md')};
  color: ${({ $active, theme }) => ($active ? theme.colors.text.primary : theme.colors.text.secondary)};
  background: ${({ $active, theme }) => ($active ? theme.colors.surface.secondary : 'transparent')};
  cursor: pointer;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  margin: 4px 0;
  position: relative;
  overflow: hidden;

  &:hover {
    background: ${tkn('colors.surface.secondary')};
    color: ${tkn('colors.text.primary')};
    transform: translateX(4px);
  }

  &:active {
    transform: translateX(2px) scale(0.98);
  }

  ${({ $active }) => $active && `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      height: 60%;
      width: 3px;
      background: ${tkn('colors.brand.primary')};
      border-radius: 0 ${tkn('radius.sm')} ${tkn('radius.sm')} 0;
    }
  `}
`;

export const NavItemContent = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const ChevronWrapper = styled.div<{ $isOpen: boolean; $isCollapsed: boolean }>`
  display: ${({ $isCollapsed }) => ($isCollapsed ? 'none' : 'flex')};
  align-items: center;
  transition: transform ${tkn('transitions.normal')};
  transform: ${({ $isOpen }) => ($isOpen ? 'rotate(180deg)' : 'rotate(0deg)')};
  color: ${tkn('colors.text.tertiary')};
`;

export const SubNavContainer = styled.div<{ $isOpen: boolean }>`
  max-height: ${({ $isOpen }) => ($isOpen ? '400px' : '0')};
  opacity: ${({ $isOpen }) => ($isOpen ? '1' : '0')};
  transform: ${({ $isOpen }) => ($isOpen ? 'translateY(0)' : 'translateY(-10px)')};
  overflow: hidden;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  padding-left: ${tkn('spacing.xl')};
  margin-top: ${({ $isOpen }) => ($isOpen ? '4px' : '0')};
`;

export const SubNavItem = styled.div<{ $active?: boolean }>`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')} cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: ${tkn('radius.md')};
  position: relative;
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  color: ${({ $active, theme }) => ($active ? theme.colors.text.primary : theme.colors.text.tertiary)};
  background: ${({ $active, theme }) => ($active ? theme.colors.surface.secondary : 'transparent')};
  margin: 2px 0;

  &:hover {
    color: ${tkn('colors.text.primary')};
    background: ${tkn('colors.surface.secondary')};
    transform: translateX(4px);
  }

  ${({ $active }) => $active && `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      height: 60%;
      width: 3px;
      background: ${tkn('colors.brand.primary')};
      border-radius: 0 ${tkn('radius.sm')} ${tkn('radius.sm')} 0;
    }
  `}
`;

export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: ${tkn('colors.background.primary')};
`;

export const HeaderContainer = styled.header`
  height: ${tkn('spacing.xxxl')};
  background: ${tkn('colors.background.secondary')}; // Same as sidebar for cleaner look
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${tkn('spacing.md')};
  
  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
  }
  
  position: sticky;
  top: 0;
  z-index: 99;
`;

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  
  @media (min-width: 768px) {
    gap: ${tkn('spacing.lg')};
  }
  
  flex: 1;
`;

export const ToggleButton = styled.button`
  background: transparent;
  border: 1px solid ${tkn('colors.border.primary')};
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  color: ${tkn('colors.text.secondary')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
    border-color: ${tkn('colors.border.focus')};
    color: ${tkn('colors.text.primary')};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

export const SearchArea = styled.div`
  display: none;
  
  @media (min-width: 768px) {
    display: flex;
    align-items: center;
    gap: ${tkn('spacing.sm')};
    color: ${tkn('colors.text.tertiary')};
    max-width: 400px;
    width: 100%;
    padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
    background: ${tkn('colors.background.primary')};
    border-radius: ${tkn('radius.md')};
    border: 1px solid ${tkn('colors.border.secondary')};
    transition: border-color ${tkn('transitions.fast')};

    &:focus-within {
      border-color: ${tkn('colors.border.focus')};
    }
  }
`;

export const SearchInput = styled.input`
  border: none;
  background: transparent;
  font-size: ${tkn('typography.fontSize.sm')};
  width: 100%;
  color: ${tkn('colors.text.primary')};
  outline: none;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const Kbd = styled.kbd`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.tertiary')};
  background: ${tkn('colors.background.secondary')};
  padding: 2px ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.secondary')};
`;

export const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  
  @media (min-width: 768px) {
    gap: ${tkn('spacing.md')};
  }
`;

export const ActionIcon = styled.button`
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tkn('colors.background.primary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.full')};
  cursor: pointer;
  color: ${tkn('colors.text.secondary')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
    color: ${tkn('colors.brand.primary')};
    transform: translateY(-2px);
    box-shadow: ${tkn('shadows.sm')};
  }

  &:active {
    transform: translateY(0);
  }
`;

export const ProfileArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  
  @media (min-width: 768px) {
    gap: ${tkn('spacing.sm')};
    padding-left: ${tkn('spacing.sm')};
    border-left: 1px solid ${tkn('colors.border.secondary')};
  }
  
  cursor: pointer;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.primary')};
  }
`;

export const ProfileInfo = styled.div`
  display: none;

  @media (min-width: 1024px) {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
`;

export const AvatarWrapper = styled.div`
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};
  
  @media (min-width: 768px) {
    width: ${tkn('spacing.xxl')};
    height: ${tkn('spacing.xxl')};
  }
  
  border-radius: ${tkn('radius.full')};
  overflow: hidden;
  border: 2px solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const ContentArea = styled.main`
  flex: 1;
  padding: ${tkn('spacing.md')};
  
  @media (min-width: 768px) {
    padding: ${tkn('spacing.xl')};
  }
  
  overflow-y: auto;
  width: 100%;
  background: ${tkn('colors.background.primary')};
`;
