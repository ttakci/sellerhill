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
  width: ${(props) => (props.$isCollapsed ? '80px' : '256px')};
  background: ${tkn('colors.background.secondary')}; /* #F8FAFC */
  color: ${tkn('colors.text.primary')};
  border-right: 1px solid ${tkn('colors.border.primary')};
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  flex-shrink: 0;

  @media (max-width: 1023px) {
    position: fixed;
    top: 0;
    left: ${({ $isMobileOpen }) => ($isMobileOpen ? '0' : '-256px')};
    height: 100vh;
    width: 256px;
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
  color: ${tkn('colors.text.tertiary')}; /* #94A3B8 */
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
`;

export const NavItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export const NavItem = styled.div<{ $active?: boolean; $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'space-between')};
  padding: 10px 14px;
  border-radius: 8px;
  color: ${({ theme, $active }) => ($active ? theme.colors.brand.primary : theme.colors.text.secondary)};
  background: ${({ $active }) => ($active ? '#EFF6FF' : 'transparent')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  position: relative;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  font-size: 14px;

  &:hover {
    background: ${tkn('colors.background.tertiary')};
    color: ${({ theme }) => theme.colors.text.primary};
  }

  ${({ theme, $active }) =>
    $active &&
    `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 2px;
      height: 20px;
      background: ${theme.colors.brand.primary};
      border-radius: 0 4px 4px 0;
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
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: ${({ $isOpen }) => ($isOpen ? '4px' : '0')};
`;

export const SidebarFooter = styled.div`
  padding: ${tkn('spacing.md')};
  border-top: 1px solid ${tkn('colors.border.primary')};
  box-sizing: border-box;
  position: relative;
`;

export const ProfileSwitcher = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  position: relative;
  max-width: 100%;
  overflow: hidden;

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }

  ${({ $isCollapsed }) => $isCollapsed && `
    justify-content: center;
    padding: 8px 0;
  `}
`;

export const BadgeWrapper = styled.div<{ variant?: 'primary' | 'success'; size?: 'sm' | 'md' }>`
  background: ${({ theme, variant }) => variant === 'success' ? '#ECFDF5' : '#EFF6FF'};
  color: ${({ theme, variant }) => variant === 'success' ? '#059669' : theme.colors.brand.primary};
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid ${({ variant }) => variant === 'success' ? '#D1FAE5' : '#DBEAFE'};
  text-transform: uppercase;
`;

export const ProfileBadge = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${tkn('colors.brand.primary')};
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
`;

export const ProfileDetails = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

export const SubNavItem = styled.div<{ $active?: boolean }>`
  padding: 8px 12px 8px 42px;
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  color: ${({ theme, $active }) => ($active ? theme.colors.brand.primary : theme.colors.text.secondary)};
  background: transparent;
  border-radius: 8px;
  margin: 0 4px;
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};

  &:hover {
    color: ${tkn('colors.text.primary')};
    background: ${tkn('colors.background.tertiary')};
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
  background: ${tkn('colors.background.secondary')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  position: sticky;
  top: 0;
  z-index: 99;
  box-shadow: ${tkn('shadows.sm')};
  width: 100%;
`;

export const HeaderInner = styled.div`
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${tkn('spacing.md')};
  box-sizing: border-box;
  
  @media (min-width: 768px) {
    padding: 0 ${tkn('spacing.xl')};
  }
`;

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: 1;
`;

export const BreadcrumbArea = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${tkn('colors.text.secondary')};

  & span {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  & .active {
    color: ${tkn('colors.text.primary')};
    font-weight: 600;
  }

  & .hoverable {
    cursor: pointer;
    &:hover {
        color: ${tkn('colors.brand.primary')};
    }
  }
`;

export const MobileMenuButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${tkn('spacing.xs')};
  margin-left: -${tkn('spacing.xs')};
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.text.secondary')};
  border-radius: ${tkn('radius.md')};

  &:hover {
    background: ${tkn('colors.background.secondary')};
  }

  @media (min-width: 1024px) {
    display: none;
  }
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
  gap: 2px; /* significantly reduced gap */
  
  @media (min-width: 768px) {
    gap: 4px;
  }
`;

export const ActionIcon = styled.button`
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  color: ${tkn('colors.text.secondary')};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.secondary')};
    color: ${tkn('colors.text.primary')};
  }

  & svg {
    width: 20px;
    height: 20px;
  }
`;

export const VerticalDivider = styled.div`
  width: 1px;
  height: 16px;
  background: ${tkn('colors.border.primary')};
  margin: 0 2px;
  flex-shrink: 0;
`;

export const LanguageSelectTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.2s;

  &:hover {
    background: #f1f5f9;
    .dark & { background: #1e293b; }
  }
`;

export const LanguageText = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  .dark & { color: #94a3b8; }
`;

export const NotificationBadge = styled.span`
  position: absolute;
  top: 10px;
  right: 10px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #EF4444; /* Red dot */
  border: 1.5px solid ${tkn('colors.background.secondary')};
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
  overflow-y: auto;
  width: 100%;
  background: ${tkn('colors.background.primary')};
`;

export const ContentInner = styled.div`
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  padding: ${tkn('spacing.md')};
  box-sizing: border-box;
  
  @media (min-width: 768px) {
    padding: ${tkn('spacing.xl')};
  }
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
