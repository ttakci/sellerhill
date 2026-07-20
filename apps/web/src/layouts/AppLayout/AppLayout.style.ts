import { keyframes, Theme } from '@emotion/react';
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
  background: ${({ theme }: { theme: Theme }) =>
    theme.mode === 'dark'
      ? theme.colors.background.primary
      : theme.colors.background.gradient || theme.colors.background.primary};
`;

/**
 * SidebarContainer — dense Sellerboard-style rail
 * Expanded ~13rem · collapsed icon rail ~3.75rem
 */
export const SidebarContainer = styled.aside<{ $isCollapsed: boolean; $isMobileOpen: boolean }>`
  width: ${(props) => (props.$isCollapsed ? '3.75rem' : '13rem')};
  background: ${tkn('colors.sidebar.background')};
  color: ${tkn('colors.sidebar.text')};
  border-right: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  transition: width ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
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
    left: ${({ $isMobileOpen }) => ($isMobileOpen ? '0' : '-13rem')};
    height: 100vh;
    width: 13rem;
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

/**
 * Top chrome height — sidebar brand strip and app page header share this
 * so their bottom borders (dividers) sit on one horizontal line.
 * 80px logo → 4rem chrome (matches page header).
 */
const APP_CHROME_HEIGHT = '4rem';

/**
 * Sellerboard brand strip: [ ☰ ] [ logo 80px ]
 * Fixed height matches HeaderContainer / HeaderInner.
 */
export const SidebarBrandRow = styled.div<{ $isCollapsed: boolean }>`
  position: relative;
  z-index: 20;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  /* Top-align: logo + menu sit high; tight gap = closer to button */
  align-items: flex-start;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'flex-start')};
  gap: ${tkn('spacing.2xs')};
  flex-shrink: 0;
  height: ${APP_CHROME_HEIGHT};
  min-height: ${APP_CHROME_HEIGHT};
  max-height: ${APP_CHROME_HEIGHT};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')} 0 ${tkn('spacing.sm')};
  box-sizing: border-box;
  border-bottom: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  overflow: visible;

  @media (max-width: 63.9375rem) {
    padding: ${tkn('spacing.2xs')} ${tkn('spacing.md')} 0 ${tkn('spacing.md')};
    justify-content: flex-start;
  }
`;

export const LogoArea = styled.div<{ $isCollapsed: boolean; $hideOnDesktopCollapsed?: boolean }>`
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  cursor: pointer;
  line-height: 0;
  background: transparent;
  ${({ $isCollapsed }) => $isCollapsed && `display: none;`}

  @media (max-width: 63.9375rem) {
    display: flex;
  }

  &:hover {
    opacity: 0.92;
  }

  & > * {
    justify-content: flex-start !important;
    width: auto;
    max-width: 100%;
  }

  /* Logo 80px */
  & img {
    display: block;
    height: 5rem !important; /* 80px */
    width: auto !important;
    max-width: 100% !important;
    max-height: 5rem !important;
    margin: 0 !important;
    margin-left: -${tkn('spacing.2xs')} !important; /* nudge toward button */
    object-fit: contain !important;
    object-position: left top;
    background: transparent !important;
  }
`;

export const NavSection = styled.nav<{ $isCollapsed: boolean }>`
  padding: ${({ $isCollapsed, theme }) =>
    $isCollapsed
      ? `${tkn('spacing.sm')({ theme })} ${tkn('spacing.xs')({ theme })}`
      : `${tkn('spacing.sm')({ theme })} ${tkn('spacing.md')({ theme })}`};
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
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
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')} ${tkn('spacing.sm')}; /* 12px */
  display: ${({ $isCollapsed }) => ($isCollapsed ? 'none' : 'block')};
  color: ${tkn('colors.sidebar.textMuted')};
  font-size: ${tkn('typography.fontSize.2xs')}; /* 0.6875rem (11px) → 2xs (10px) closest */
  font-weight: ${tkn('typography.fontWeight.bold')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wide')};
`;

export const NavDivider = styled.div`
  height: 0.0625rem;
  background: ${tkn('colors.sidebar.divider')};
  margin: ${tkn('spacing.sm-md')} ${tkn('spacing.sm')}; /* 12px */
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
    $isCollapsed ? '0.5rem 0' : $isSubItem ? '0.5rem 0.75rem 0.5rem 1.25rem' : '0.5rem 1rem'};
  border-radius: ${tkn('radius.sm')};
  color: ${tkn('colors.sidebar.text')};
  background: ${({ $active }) => ($active ? tkn('colors.sidebar.active') : 'transparent')};
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};
  position: relative;
  font-weight: ${({ $active, theme }) =>
    $active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium};
  font-size: ${tkn('typography.fontSize.md')};
  min-height: 2.5rem;

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }

  ${({ $active, theme }) =>
    $active &&
    `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 0.1875rem;
      height: 1.25rem;
      background: ${theme.colors.sidebar.accent};
      border-radius: 0 ${tkn('radius.sm')({ theme })} ${tkn('radius.sm')({ theme })} 0;
    }
  `}
`;

export const NavItemContent = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'flex-start')};
  gap: ${tkn('spacing.sm-md')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  font-size: ${tkn('typography.fontSize.md')};

  & svg {
    color: inherit;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
  }
`;
export const ChevronWrapper = styled.div<{ $isOpen: boolean; $isCollapsed: boolean }>`
  display: ${({ $isCollapsed }) => ($isCollapsed ? 'none' : 'flex')};
  align-items: center;
  transition: transform ${tkn('transitions.normal')};
  transform: ${({ $isOpen }) => ($isOpen ? 'rotate(180deg)' : 'rotate(0deg)')};
  color: ${tkn('colors.sidebar.textMuted')};
`;

export const SubNavContainer = styled.div<{ $isOpen: boolean }>`
  max-height: ${({ $isOpen }) => ($isOpen ? '62.5rem' : '0')}; /* 1000px */
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  margin-top: ${({ $isOpen, theme }) => ($isOpen ? theme.spacing.xs : '0')};
`;

export const SidebarFooter = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  box-sizing: border-box;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/**
 * Hamburger LEFT of logo — top-aligned with mark, small gap via row gap.
 */
export const SidebarCollapseButton = styled.button<{ $isCollapsed: boolean }>`
  display: none;
  position: static;
  flex: 0 0 auto;
  align-self: flex-start;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  margin: ${tkn('spacing.sm')} 0 0 0;
  border-radius: ${tkn('radius.sm')};
  cursor: pointer;
  background: transparent;
  border: none;
  color: ${tkn('colors.sidebar.text')};
  box-sizing: border-box;
  transition:
    background ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')};

  @media (min-width: 64rem) {
    display: inline-flex;
  }

  @media (max-width: 63.9375rem) {
    display: none;
  }

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
    color: ${tkn('colors.sidebar.foreground')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.sidebar.accent')};
    outline-offset: 0.125rem;
  }
`;

export const LogoutButton = styled.button<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.sm')};
  cursor: pointer;
  background: transparent;
  border: none;
  color: ${tkn('colors.sidebar.text')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  min-height: 2.75rem;
  width: 100%;
  box-sizing: border-box;
  transition:
    background ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')};
  ${({ $isCollapsed }) => $isCollapsed && `justify-content: center; padding-left: 0; padding-right: 0;`}

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
    color: ${tkn('colors.semantic.error')};
  }
`;

export const ProfileSwitcher = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')}; /* 12px */
  padding: ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  transition: all ${tkn('transitions.fast')};
  position: relative;
  max-width: 100%;
  overflow: hidden;

  ${({ $isCollapsed, theme }) =>
    $isCollapsed &&
    `
    justify-content: center;
    padding: ${theme.spacing.sm} 0;
  `}
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
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.bold')};
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
  /* Same height as SidebarBrandRow so dividers align */
  height: 4rem;
  min-height: 4rem;
  max-height: 4rem;
  background: ${tkn('colors.surface.primary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  position: sticky;
  top: 0;
  z-index: 99;
  box-shadow: ${tkn('shadows.sm')};
  width: 100%;
  box-sizing: border-box;
`;

export const HeaderInner = styled.div`
  max-width: 90rem; /* 1440px */
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  /* Vertical: none — height comes from HeaderContainer; H-pad matches ContentInner */
  padding: 0 ${tkn('spacing.lg')};
  box-sizing: border-box;

  @media (min-width: 48rem) {
    flex-wrap: nowrap;
    padding: 0 ${tkn('spacing.xl')};
    gap: 0;
  }

  @media (min-width: 64rem) {
    padding: 0 ${tkn('spacing.xxl')};
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
    /* 1024px — desktop uses in-sidebar collapse control */
    display: none;
  }
`;

/** @deprecated Desktop toggle moved into sidebar footer — kept only if referenced */
export const ToggleButton = styled.button`
  background: transparent;
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};
  display: none;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  transition: all ${tkn('transitions.fast')};

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
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
`;

export const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  order: 2; /* Ensure it stays on top row with HeaderLeft */

  @media (min-width: 48rem) {
    /* 768px */
    gap: ${tkn('spacing.xs')};
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
  margin: 0 ${tkn('spacing.2xs')};
  flex-shrink: 0;
`;

export const LanguageSelectTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  cursor: pointer;
  padding: ${tkn('spacing.2xs')} 0.375rem; /* 2px 6px — 6px no exact token */
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
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
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
  background: ${tkn('colors.semantic.error')}; /* Red dot */
  border: 0.09375rem solid ${tkn('colors.background.secondary')}; /* 1.5px */
  box-sizing: content-box;
`;

export const ProfileArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};

  @media (min-width: 48rem) {
    /* 768px */
    gap: ${tkn('spacing.sm-md')}; /* 12px */
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

/**
 * HeaderProfileArea - User profile display in the top-right header
 */
export const HeaderProfileArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};
  max-width: 15rem; /* 240px */

  &:hover {
    background: ${tkn('colors.background.primary')};
  }

  @media (max-width: 47.9375rem) {
    /* 767px — hide text on mobile, show only avatar */
    .profile-info {
      display: none;
    }
  }
`;

/**
 * HeaderProfileInfo - Name + email text block (hidden on mobile)
 */
export const HeaderProfileInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  overflow: hidden;

  & > span {
    max-width: 12rem; /* 192px */
    line-height: ${tkn('typography.lineHeight.tight')};
  }

  @media (max-width: 47.9375rem) {
    /* 767px */
    display: none;
  }
`;

/**
 * ProfileDropdownHeader - Name + email header inside the profile dropdown
 */
export const ProfileDropdownHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};

  & > span {
    line-height: ${tkn('typography.lineHeight.tight')};
  }
`;

/**
 * HeaderProfileBadge - Circular initials avatar for header
 */
export const HeaderProfileBadge = styled.div`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: 50%;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  flex-shrink: 0;
`;

export const ContentArea = styled.main`
  flex: 1;
  overflow-y: auto;
  width: 100%;
  background: transparent;
  display: flex;
  flex-direction: column;
`;

/**
 * Sole page gutter for authenticated app screens.
 * Feature pages use `PageContainer` with padding: 0 — never double-pad.
 * Title starts at the same inset on every route.
 */
export const ContentInner = styled.div`
  max-width: 90rem; /* 1440px */
  width: 100%;
  margin: 0 auto;
  padding: ${tkn('spacing.lg')};
  box-sizing: border-box;
  flex: 1;

  @media (min-width: 48rem) {
    padding: ${tkn('spacing.xl')};
  }

  @media (min-width: 64rem) {
    padding: ${tkn('spacing.xl')} ${tkn('spacing.xxl')};
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
  background: ${tkn('colors.surface.loadingOverlay')};
  backdrop-filter: blur(0.25rem); /* 4px */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: ${tkn('spacing.xxxl')}; /* High z-index */
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  visibility: ${({ $visible }) => ($visible ? 'visible' : 'hidden')};
  transition: all ${tkn('transitions.normal')};

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
