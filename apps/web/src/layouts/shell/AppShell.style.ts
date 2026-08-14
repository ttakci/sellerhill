import { keyframes, Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

/**
 * Expanded sidebar rail. Single source of truth — the docked width, the mobile
 * off-canvas width and its hidden offset must always be the same number.
 */
const SIDEBAR_WIDTH = '16rem'; /* 256px — "Bekleyen Aksiyonlar" + its count badge is the longest nav row; anything narrower clips it */

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
 * Expanded ~12rem · collapsed icon rail ~3.75rem
 */
export const SidebarContainer = styled.aside<{ $isCollapsed: boolean; $isMobileOpen: boolean }>`
  width: ${(props) => (props.$isCollapsed ? '3.75rem' : SIDEBAR_WIDTH)};
  background: ${tkn('colors.sidebar.background')};
  color: ${tkn('colors.sidebar.text')};
  border-right: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  transition: width ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  z-index: ${tkn('zIndex.sidebar')};
  flex-shrink: 0;
  position: relative;
  overflow: hidden;

  @media (max-width: 63.9375rem) {
    /* 1023px */
    position: fixed;
    top: 0;
    left: ${({ $isMobileOpen }) => ($isMobileOpen ? '0' : `-${SIDEBAR_WIDTH}`)};
    height: 100vh;
    width: ${SIDEBAR_WIDTH};
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
    z-index: ${tkn('zIndex.scrim')};
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
 * Logo box inside the brand strip. It must stay comfortably under
 * APP_CHROME_HEIGHT — the mark used to be 5rem tall inside a 4rem row, so the
 * box overflowed the strip and only looked contained because `max-width: 100%`
 * happened to bind first. Height is the binding constraint now, so the mark is
 * a predictable size instead of a side effect of the rail width.
 */
const SIDEBAR_LOGO_HEIGHT = '2.25rem'; /* 36px — matches the hamburger beside it */

/**
 * Content column cap. Header and page content MUST share it, otherwise the
 * breadcrumb and the page title stop lining up at wide viewports.
 */
const CONTENT_MAX_WIDTH = '90rem'; /* 1440px */

/**
 * Sellerboard brand strip: [ ☰ ] [ logo ]
 * Fixed height matches HeaderContainer / HeaderInner. Both children are the
 * same height now, so the row centres them instead of top-aligning around an
 * oversized mark.
 */
export const SidebarBrandRow = styled.div<{ $isCollapsed: boolean }>`
  position: relative;
  z-index: 20;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'flex-start')};
  gap: ${tkn('spacing.sm+')};
  flex-shrink: 0;
  height: ${APP_CHROME_HEIGHT};
  min-height: ${APP_CHROME_HEIGHT};
  max-height: ${APP_CHROME_HEIGHT};
  padding: 0 ${tkn('spacing.sm')};
  box-sizing: border-box;
  border-bottom: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  overflow: hidden;

  @media (max-width: 63.9375rem) {
    padding: 0 ${tkn('spacing.md')};
    justify-content: flex-start;
  }
`;

export const LogoArea = styled.div<{ $isCollapsed: boolean; $hideOnDesktopCollapsed?: boolean }>`
  flex: 0 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
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

  & img {
    display: block;
    height: ${SIDEBAR_LOGO_HEIGHT} !important;
    width: auto !important;
    max-width: 100% !important;
    max-height: ${SIDEBAR_LOGO_HEIGHT} !important;
    margin: 0 !important;
    object-fit: contain !important;
    object-position: left center;
    background: transparent !important;
  }
`;

export const NavSection = styled.nav<{ $isCollapsed: boolean }>`
  padding: ${({ $isCollapsed, theme }) =>
    $isCollapsed
      ? `${tkn('spacing.md')({ theme })} ${tkn('spacing.xs')({ theme })} ${tkn('spacing.sm')({ theme })}`
      : `${tkn('spacing.md')({ theme })} ${tkn('spacing.md')({ theme })} ${tkn('spacing.sm')({ theme })}`};
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'stretch')};
  gap: ${tkn('spacing.xs')};
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
  width: ${({ $isCollapsed }) => ($isCollapsed ? SIDEBAR_LOGO_HEIGHT : '100%')};
  height: ${({ $isCollapsed }) => ($isCollapsed ? SIDEBAR_LOGO_HEIGHT : 'auto')};
  align-self: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'stretch')};
  box-sizing: border-box;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'flex-start')};
  gap: ${({ $isCollapsed, theme }) => ($isCollapsed ? '0' : tkn('spacing.sm')({ theme }))};
  padding: ${({ $isCollapsed, $isSubItem, theme }) =>
    $isCollapsed
      ? '0'
      : $isSubItem
        ? `${tkn('spacing.sm')({ theme })} ${tkn('spacing.sm-md')({ theme })} ${tkn('spacing.sm')({ theme })} ${tkn(
            'spacing.md+'
          )({ theme })}`
        : `${tkn('spacing.sm')({ theme })} ${tkn('spacing.md')({ theme })}`};
  /* Selected item is a full-width filled pill (brand-blue), not a left accent bar */
  border-radius: ${tkn('radius.md')};
  color: ${({ $active, theme }) => ($active ? theme.colors.text.inverse : theme.colors.sidebar.text)};
  background: ${(props) => (props.$active ? tkn('colors.sidebar.accent')(props) : 'transparent')};
  cursor: pointer;
  transition:
    background ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')};
  position: relative;
  font-weight: ${({ $active, theme }) =>
    $active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium};
  font-size: ${tkn('typography.fontSize.sm')};
  min-height: 2rem;

  &:hover {
    background: ${(props) =>
      props.$active ? tkn('colors.sidebar.accent')(props) : tkn('colors.sidebar.hover')(props)};
  }
`;

/**
 * Count chip on a nav item (pending actions).
 *
 * Deliberately NOT the `Badge` atom: badges are tuned for light page surfaces,
 * and the sidebar is a dark, always-dark panel in both themes — a `warning`
 * badge there renders as a pale block that fights the nav pill. This chip is
 * drawn from the semantic palette against the sidebar's own ink instead.
 *
 * `$urgent` is the only colour decision: red when something critical is
 * waiting, neutral-bright otherwise. The count itself is the information, so
 * the chip must never be the loudest thing in the nav when nothing is on fire.
 */
export const NavBadge = styled.span<{ $urgent: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 ${tkn('spacing.2xs+')};
  border-radius: ${tkn('radius.full')};
  flex-shrink: 0;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: ${tkn('colors.text.inverse')};
  background: ${({ theme, $urgent }) => ($urgent ? theme.colors.semantic.error : theme.colors.semantic.warning)};
`;

/**
 * Collapsed-rail form of the same signal. There is no room for a number on a
 * 3.5rem rail, so the count degrades to a presence dot pinned to the icon —
 * the item still reads as "needs you", and expanding the sidebar (or the
 * tooltip) gives the number.
 */
export const NavBadgeDot = styled.span<{ $urgent: boolean }>`
  position: absolute;
  top: 0.3125rem;
  right: 0.3125rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: ${tkn('radius.full')};
  background: ${({ theme, $urgent }) => ($urgent ? theme.colors.semantic.error : theme.colors.semantic.warning)};
`;

export const NavItemContent = styled.div<{ $isCollapsed: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $isCollapsed }) => ($isCollapsed ? 'center' : 'flex-start')};
  gap: ${tkn('spacing.sm-md')};
  overflow: hidden;
  flex: 1;
  min-width: 0;
  font-size: ${tkn('typography.fontSize.sm')};

  & svg {
    color: inherit;
    width: 1.125rem;
    height: 1.125rem;
    flex-shrink: 0;
  }
`;

/**
 * The label text itself, not `NavItemContent`. `text-overflow: ellipsis`
 * doesn't reliably truncate a raw text node sitting beside an icon inside a
 * flex row — the browser has no single inline box to clip, so the word just
 * got hard-clipped by `overflow: hidden` with no "…", and on a narrow rail
 * the badge sibling ended up crowding right against the cut-off letters. This
 * span is the one flexing, overflow-hidden box the ellipsis actually applies
 * to, so the label always truncates cleanly and leaves the badge its gap.
 */
export const NavItemLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
  transition: max-height ${tkn('transitions.normal')};
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
 * Hamburger LEFT of logo — same box height as the mark, centred by the row.
 */
export const SidebarCollapseButton = styled.button<{ $isCollapsed: boolean }>`
  display: none;
  position: static;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: ${SIDEBAR_LOGO_HEIGHT};
  height: ${SIDEBAR_LOGO_HEIGHT};
  padding: 0;
  margin: 0;
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
  height: ${APP_CHROME_HEIGHT};
  min-height: ${APP_CHROME_HEIGHT};
  max-height: ${APP_CHROME_HEIGHT};
  background: ${tkn('colors.surface.primary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  position: sticky;
  top: 0;
  z-index: ${tkn('zIndex.sticky')};
  box-shadow: ${tkn('shadows.sm')};
  width: 100%;
  box-sizing: border-box;
`;

export const HeaderInner = styled.div`
  max-width: ${CONTENT_MAX_WIDTH};
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
  transition: background ${tkn('transitions.fast')};

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
  white-space: nowrap;
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.secondary')};
  transition: color ${tkn('transitions.fast')};
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
  max-width: ${CONTENT_MAX_WIDTH};
  width: 100%;
  margin: 0 auto;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')} ${tkn('spacing.lg')};
  box-sizing: border-box;
  flex: 1;

  @media (min-width: 48rem) {
    padding: ${tkn('spacing.md')} ${tkn('spacing.xl')} ${tkn('spacing.xl')};
  }

  @media (min-width: 64rem) {
    padding: ${tkn('spacing.md')} ${tkn('spacing.xxl')} ${tkn('spacing.xl')};
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
  /* Was tkn('spacing.xxxl') -> the string "4rem", which is invalid for the
     unitless z-index property, so the browser dropped the declaration entirely
     and the blocking overlay could paint BEHIND the sidebar, a drawer or a modal. */
  z-index: ${tkn('zIndex.loading')};
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
