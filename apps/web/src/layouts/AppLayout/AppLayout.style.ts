import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

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
  width: ${(props) => (props.$isCollapsed ? '80px' : '290px')};
  background: #1C2434; /* TailAdmin Deep Primary Dark */
  color: #DEE4EE;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  flex-shrink: 0;

  @media (max-width: 1023px) {
    position: fixed;
    top: 0;
    left: ${({ $isMobileOpen }) => ($isMobileOpen ? '0' : '-290px')};
    height: 100vh;
    width: 290px;
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
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    z-index: 999;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const LogoArea = styled.div<{ $isCollapsed: boolean }>`
  height: 80px;
  padding: 0 ${tkn('spacing.lg')};
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'flex-start')};
  gap: ${tkn('spacing.sm')};
  cursor: pointer;
  transition: opacity ${tkn('transitions.fast')};
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
`;

export const NavSection = styled.nav`
  padding: ${tkn('spacing.md')} ${tkn('spacing.md')};
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-thumb { background: #333a48; border-radius: ${tkn('radius.full')}; }
`;

export const NavLabelWrapper = styled.div<{ $isCollapsed: boolean }>`
  padding: 1.5rem 1rem 0.5rem;
  display: ${({ $isCollapsed }) => ($isCollapsed ? 'none' : 'block')};
  color: #8A99AF;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

export const NavItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export const NavItem = styled.div<{ $active?: boolean; $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'space-between')};
  padding: 12px 16px;
  border-radius: 4px;
  color: ${({ $active }) => ($active ? '#FFFFFF' : '#DEE4EE')};
  background: ${({ $active }) => ($active ? '#333A48' : 'transparent')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  position: relative;
  font-weight: 500;
  font-size: 16px;

  &:hover {
    background: #333A48;
    color: #FFFFFF;
  }

  ${({ $active }) =>
    $active &&
    `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 4px;
      height: 24px;
      background: #3C50E0;
      border-radius: 0 4px 4px 0;
      display: none; /* TailAdmin sometimes uses a left bar, sometimes just bg change. I'll stick to bg + hover for now. */
    }
  `}
`;

export const NavItemContent = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  
  & svg {
    color: inherit;
    width: 18px;
    height: 18px;
  }
`;

export const ChevronWrapper = styled.div<{ $isOpen: boolean; $isCollapsed: boolean }>`
  display: ${({ $isCollapsed }) => ($isCollapsed ? 'none' : 'flex')};
  align-items: center;
  transition: transform ${tkn('transitions.normal')};
  transform: ${({ $isOpen }) => ($isOpen ? 'rotate(180deg)' : 'rotate(0deg)')};
  color: #8a99af;
`;

export const SubNavContainer = styled.div<{ $isOpen: boolean }>`
  max-height: ${({ $isOpen }) => ($isOpen ? '1000px' : '0')};
  /* Opacity removed to prevent visibility issues during transition or rendering */
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: ${({ $isOpen }) => ($isOpen ? '4px' : '0')};
`;

export const SubNavItem = styled.div<{ $active?: boolean }>`
  padding: 8px 12px 8px 46px; /* 46px indent */
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  color: ${({ $active }) => ($active ? '#FFFFFF' : '#DEE4EE')};
  background: ${({ $active }) => ($active ? 'rgba(255, 255, 255, 0.05)' : 'transparent')}; /* Subtle active/hover bg or just color? User wants same logic. I'll use subtle bg to differentiate or match main item. Main item uses #333A48. I'll use transparent for default, #333A48 for hover/active matching main item. */
  border-radius: 4px;
  margin: 0 16px; /* Match NavItem horizontal margin if any, or just sit inside */
  font-size: 15px;
  font-weight: 400;

  &:hover {
    color: #FFFFFF;
    background: #333A48; /* Same as main nav item hover */
  }
`;

export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: ${tkn('colors.background.primary')};
`;

export const HeaderContainer = styled.header`
  height: 80px;
  height: 80px;
  background: ${tkn('colors.background.secondary')}; /* Usually white in light mode */
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
  box-shadow: ${tkn('shadows.sm')};
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
  width: 48px;
  height: 48px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${tkn('colors.background.primary')};
  border: 1px solid #E2E8F0; /* Explicitly visible border for now */
  .dark & {
    border-color: ${tkn('colors.border.secondary')};
  }
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

export const NotificationBadge = styled.span`
  position: absolute;
  top: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${tkn('colors.semantic.error')}; /* Red dot */
  border: 2px solid ${tkn('colors.background.secondary')}; /* White ring to separate from icon */
  box-sizing: content-box;

`;

export const ProfileArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  
  @media (min-width: 768px) {
    gap: 12px;
    padding-left: ${tkn('spacing.md')};
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
    align-items: flex-start;
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

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const LoadingOverlay = styled.div<{ $visible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${tkn('spacing.xxxl')}; /* High z-index */
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  transition: all ${tkn('transitions.normal')};

  .dark & {
    background: rgba(0, 0, 0, 0.7);
  }

  svg {
    animation: ${spin} 1s linear infinite;
    color: ${tkn('colors.brand.primary')};
  }
`;
export const PageTitle = styled(Text)`
  font-size: inherit;
`;

export const DropdownHeaderWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export const ModalFooterWrapper = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  width: 100%;
`;
