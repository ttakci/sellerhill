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
  background: ${({ theme }: any) =>
    theme.mode === 'dark'
      ? theme.colors.background.primary
      : theme.colors.background.gradient || theme.colors.background.primary
  };
`;

/**
 * SidebarContainer - Theme aware and responsive
 */
export const SidebarContainer = styled.aside<{ $isCollapsed: boolean; $isMobileOpen: boolean }>`
  width: ${(props) => (props.$isCollapsed ? '5rem' : '18rem')};
  background: ${tkn('colors.sidebar.background')};
  color: ${tkn('colors.sidebar.text')};
  border-right: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;

  @media (max-width: 63.9375rem) {
    /* 1023px */
    position: fixed;
    top: 0;
    left: ${({ $isMobileOpen }) => ($isMobileOpen ? '0' : '-18rem')};
    height: 100vh;
    width: 18rem;
    box-shadow: ${tkn('shadows.xl')};
  }
`;

/**
 * Overlay for mobile sidebar
 */
export const SidebarOverlay = styled.div<{ $isOpen: boolean }>`
  display: none;

  @media (max-width: 63.9375rem) {
    /* 1023px */
    display: ${({ $isOpen }) => ($isOpen ? 'block' : 'none')};
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: ${tkn('colors.surface.overlay')};
    backdrop-filter: blur(0.125rem); /* 2px */
    z-index: 999;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

export const LogoArea = styled.div<{ $isCollapsed: boolean }>`
  height: 7.5rem; /* 120px */
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  position: relative;
  z-index: 10; /* Ensure logo is always on top */

  & img {
    transition: all ${tkn('transitions.normal')};
    /* Allow the logo to maintain its premium size even in collapsed state */
    max-width: none;
    filter: drop-shadow(0 0 1.25rem rgba(59, 130, 246, 0.3)); /* 20px */
  }
`;

export const NavSection = styled.nav`
  padding: 0 ${tkn('spacing.md')} ${tkn('spacing.md')};
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 1;

  &::-webkit-scrollbar {
    width: 0.3125rem; /* 5px */
  }
  &::-webkit-scrollbar-thumb {
    background: ${tkn('colors.sidebar.active')};
    border-radius: ${tkn('radius.full')};
  }
`;

export const NavLabelWrapper = styled.div<{ $isCollapsed: boolean }>`
  padding: 0.75rem 1rem 0.5rem;
  display: ${({ $isCollapsed }) => ($isCollapsed ? 'none' : 'block')};
  color: ${tkn('colors.sidebar.textMuted')};
  font-size: 0.6875rem; /* 11px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.0625rem; /* 1px */
`;

export const NavDivider = styled.div`
  height: 0.0625rem;
  background: ${tkn('colors.sidebar.divider')};
  margin: 0.75rem 0.5rem;
`;

export const NavItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;

export const NavItem = styled.div<{ $active?: boolean; $isCollapsed: boolean; $isSubItem?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'space-between')};
  padding: ${({ $isCollapsed, $isSubItem }) =>
    $isCollapsed ? '0.625rem 0.875rem' : $isSubItem ? '0.625rem 0.875rem 0.625rem 1.75rem' : '0.625rem 0.875rem'};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.sidebar.text')};
  background: ${({ $active }) => ($active ? tkn('colors.sidebar.active') : 'transparent')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  position: relative;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  font-size: 0.875rem;

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }

  ${({ $active, $isCollapsed, $isSubItem }) =>
    $active &&
    `
    &::before {
      content: '';
      position: absolute;
      left: ${$isCollapsed ? '0' : $isSubItem ? '0.5rem' : '0'};
      top: 50%;
      transform: translateY(-50%);
      width: 0.1875rem;
      height: 1.5rem;
      background: ${tkn('colors.sidebar.accent')};
      border-radius: 0 0.25rem 0.25rem 0;
    }
  `}
`;

export const NavItemContent = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */

  white-space: nowrap; /* Prevent text wrapping */
  overflow: hidden; /* Hide overflow */
  text-overflow: ellipsis; /* Add ellipsis for overflow text */
  flex: 1; /* Allow content to take available space */
  min-width: 0; /* Ensure flex child can shrink below content size */

  & svg {
    color: inherit;
    width: 1.125rem; /* 18px */
    height: 1.125rem; /* 18px */
    flex-shrink: 0; /* Prevent icon from shrinking */
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
  max-height: ${({ $isOpen }) => ($isOpen ? '62.5rem' : '0')}; /* 1000px */
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem; /* 2px */
  margin-top: ${({ $isOpen }) => ($isOpen ? '0.25rem' : '0')}; /* 4px */
`;

export const SidebarFooter = styled.div`
  padding: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  box-sizing: border-box;
  position: relative;
  z-index: 1;
`;

export const ProfileSwitcher = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  position: relative;
  max-width: 100%;
  overflow: hidden;

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }

  ${({ $isCollapsed }) =>
    $isCollapsed &&
    `
    justify-content: center;
    padding: 0.5rem 0;
  `}
`;

export const BadgeWrapper = styled.div<{ variant?: 'primary' | 'success'; size?: 'sm' | 'md' }>`
  background: ${({ theme, variant }) => (variant === 'success' ? theme.colors.semanticTint.success : theme.colors.semanticTint.info)};
  color: ${({ theme, variant }) => (variant === 'success' ? theme.colors.semantic.success : theme.colors.brand.primary)};
  font-size: 0.625rem; /* 10px */
  font-weight: 700;
  padding: 0.125rem 0.375rem; /* 2px 6px */
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${({ theme, variant }) => (variant === 'success' ? theme.colors.semanticTintBorder.success : theme.colors.semanticTintBorder.info)};
  text-transform: uppercase;
`;

export const ProfileBadge = styled.div`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.sidebar.text')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem; /* 14px */
  font-weight: 700;
  flex-shrink: 0;
`;

export const ProfileDetails = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  & > span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 10rem;
  }
`;

export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: transparent;
`;

export const HeaderContainer = styled.header`
  height: auto;
  min-height: 5rem;
  background: ${tkn('colors.surface.primary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  position: sticky;
  top: 0;
  z-index: 99;
  box-shadow: ${tkn('shadows.sm')};
  width: 100%;
`;

export const HeaderInner = styled.div`
  max-width: 90rem; /* 1440px */
  width: 100%;
  margin: 0 auto;
  min-height: 5rem;
  display: flex;
  flex-wrap: wrap; /* Allow wrapping */
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  box-sizing: border-box;

  @media (min-width: 48rem) {
    /* 768px */
    flex-wrap: nowrap; /* Prevent wrapping on desktop */
    padding: 0 ${tkn('spacing.lg')};
    gap: 0;
  }
`;

export const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  order: 1; /* First on mobile */

  @media (min-width: 48rem) {
    /* 768px */
    width: auto;
    gap: ${tkn('spacing.md')};
    order: 0;
    flex: 0; /* Let it shrink on desktop, breadcrumb takes focus or shared */
  }
`;

export const BreadcrumbArea = styled.div`
  display: flex;
  align-items: center;
  margin-left: 0; /* Reset margin */
  width: 100%; /* Force new line on mobile */
  flex-basis: 100%; /* Ensure it breaks to a new line and takes full width */
  order: 3; /* Last on mobile (New Line) */
  margin-top: ${tkn('spacing.xs')};

  @media (min-width: 48rem) {
    /* 768px */
    width: auto;
    flex-basis: auto;
    order: 2; /* Middle on desktop */
    margin-top: 0;
    margin-left: ${tkn('spacing.md')};
    flex: 1; /* Take remaining space on desktop */
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
    background: ${tkn('colors.brand.secondary')};
    color: ${tkn('colors.brand.primary')};
  }

  @media (min-width: 64rem) {
    /* 1024px */
    display: none;
  }
`;

export const ToggleButton = styled.button`
  background: transparent;
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};
  display: none; /* Hidden by default on mobile */
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  color: ${tkn('colors.text.primary')}; /* Ensure high contrast */
  transition: all ${tkn('transitions.fast')};

  @media (min-width: 64rem) {
    /* 1024px */
    display: flex; /* Show on desktop */
  }

  &:hover {
    background: ${tkn('colors.brand.secondary')};
    border-color: ${tkn('colors.brand.primary')};
    color: ${tkn('colors.brand.primary')};
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

export const SearchArea = styled.div`
  display: none;

  @media (min-width: 48rem) {
    /* 768px */
    display: flex;
    align-items: center;
    gap: ${tkn('spacing.sm')};
    color: ${tkn('colors.text.tertiary')};
    max-width: 25rem; /* 400px */
    width: 100%;
    padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
    background: ${tkn('colors.background.primary')};
    border-radius: ${tkn('radius.md')};
    border: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
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
  padding: 0.125rem ${tkn('spacing.sm')}; /* 2px */
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
`;

export const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem; /* 2px */
  order: 2; /* Ensure it stays on top row with HeaderLeft */

  @media (min-width: 48rem) {
    /* 768px */
    gap: 0.25rem; /* 4px */
    order: 3;
  }
`;

export const ActionIcon = styled.button`
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
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
    background: ${tkn('colors.brand.secondary')};
    color: ${tkn('colors.brand.primary')};
    transform: translateY(-0.0625rem);
  }

  & svg {
    width: 1.25rem; /* 20px */
    height: 1.25rem; /* 20px */
  }
`;

export const VerticalDivider = styled.div`
  width: 0.0625rem; /* 1px */
  height: 1rem; /* 16px */
  background: ${tkn('colors.border.primary')};
  margin: 0 0.125rem; /* 2px */
  flex-shrink: 0;
`;

export const LanguageSelectTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem; /* 2px */
  cursor: pointer;
  padding: 0.125rem 0.375rem; /* 2px 6px */
  border-radius: ${tkn('radius.sm')};
  transition: background 0.2s;

  &:hover {
    background: ${tkn('colors.brand.secondary')};
    & > span {
      color: ${tkn('colors.brand.primary')};
    }
    & svg {
      color: ${tkn('colors.brand.primary')};
    }
  }
`;

export const LanguageText = styled.span`
  font-size: 0.75rem; /* 12px */
  font-weight: 700;
  color: ${tkn('colors.text.secondary')};
  transition: color ${tkn('transitions.fast')};
  text-transform: uppercase;
`;

export const NotificationBadge = styled.span`
  position: absolute;
  top: 0.625rem; /* 10px */
  right: 0.625rem; /* 10px */
  width: 0.375rem; /* 6px */
  height: 0.375rem; /* 6px */
  border-radius: 50%;
  background: #ef4444; /* Red dot */
  border: 0.09375rem solid ${tkn('colors.background.secondary')}; /* 1.5px */
  box-sizing: content-box;
`;

export const ProfileArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};

  @media (min-width: 48rem) {
    /* 768px */
    gap: 0.75rem; /* 12px */
    padding-left: ${tkn('spacing.md')};
    border-left: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
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

  @media (min-width: 64rem) {
    /* 1024px */
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
`;

export const AvatarWrapper = styled.div`
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};

  @media (min-width: 48rem) {
    /* 768px */
    width: ${tkn('spacing.xxl')};
    height: ${tkn('spacing.xxl')};
  }

  border-radius: ${tkn('radius.full')};
  overflow: hidden;
  border: 0.125rem solid ${tkn('colors.border.primary')}; /* 2px */
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
  background: transparent;
  display: flex;
  flex-direction: column;
`;

export const ContentInner = styled.div`
  max-width: 90rem; /* 1440px */
  width: 100%;
  margin: 0 auto;
  padding: ${tkn('spacing.md')};
  box-sizing: border-box;
  flex: 1;

  @media (min-width: 48rem) {
    /* 768px */
    padding: ${tkn('spacing.lg')};
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
  backdrop-filter: blur(0.25rem); /* 4px */
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
