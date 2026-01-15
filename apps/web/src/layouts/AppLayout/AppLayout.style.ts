import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const LayoutWrapper = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: ${tkn('colors.background.primary')};

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${tkn('colors.border.secondary')}; border-radius: 10px; }
`;

export const SidebarContainer = styled.aside<{ $isOpen: boolean; $isCollapsed: boolean }>`
  width: ${(props) => (props.$isCollapsed ? '80px' : '256px')};
  background: ${tkn('colors.background.tertiary')}; /* slate-950 in Stitch */
  color: ${tkn('colors.text.secondary')}; /* slate-400 */
  transition: all ${tkn('transitions.normal')};
  display: flex;
  flex-direction: column;
  z-index: 999;
  border-right: 1px solid ${tkn('colors.border.secondary')};
  
  @media (max-width: 1024px) {
    position: fixed;
    height: 100vh;
    left: ${(props) => (props.$isOpen ? '0' : '-256px')};
    width: 256px;
  }
`;

export const LogoArea = styled.div`
  padding: ${tkn('spacing.lg')}; /* p-6 */
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')}; /* gap-3 */
`;

export const LogoBox = styled.div`
  width: ${tkn('spacing.xl')};
  height: ${tkn('spacing.xl')};
  background: ${tkn('colors.brand.primary')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const LogoText = styled.span`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.inverse')}; /* Always white for visibility on dark sidebar */
  letter-spacing: -0.025em;
`;


export const NavSection = styled.nav`
  padding: ${tkn('spacing.md')}; /* px-4 py-4 */
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  overflow-y: auto;
`;

export const NavGroup = styled.div`
  margin-bottom: ${tkn('spacing.sm')};
`;

export const NavLabel = styled.p`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.md')} ${tkn('spacing.sm')};
  font-size: ${tkn('typography.fontSize.xs')}; /* text-xs */
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.tertiary')}; /* slate-600 */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: ${tkn('typography.fontFamily.sans')};
`;

export const NavItem = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')}; /* Reduced vertical padding slightly */
  margin-bottom: 0.125rem;
  border-radius: ${tkn('radius.md')};
  color: ${(props) => (props.$active ? tkn('colors.text.inverse')(props) : tkn('colors.text.secondary')(props))};
  background: ${(props) => (props.$active ? tkn('colors.brand.secondary')(props) : 'transparent')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  font-family: ${tkn('typography.fontFamily.sans')};

  &:hover {
    background: ${(props) => (props.$active ? tkn('colors.brand.secondary')(props) : tkn('colors.background.secondary')(props))};
    color: ${tkn('colors.text.primary')};
  }
`;

export const NavItemContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  font-size: ${tkn('typography.fontSize.sm')}; /* text-sm */
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const SubNavDropdown = styled.div`
  margin-left: ${tkn('spacing.md')}; /* ml-4 */
  padding-left: ${tkn('spacing.md')}; /* pl-4 */
  border-left: 1px solid ${tkn('colors.border.secondary')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.xs')};
`;

export const SubNavItem = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${(props) => (props.$active ? tkn('colors.brand.primary')(props) : tkn('colors.text.secondary')(props))};
  background: ${(props) => (props.$active ? tkn('colors.brand.secondary')(props) : 'transparent')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${(props) => (props.$active ? tkn('colors.brand.primary')(props) : tkn('colors.text.primary')(props))};
    background: ${tkn('colors.background.secondary')};
  }
`;

export const Badge = styled.span<{ $variant?: 'primary' | 'success' }>`
  padding: 0.125rem ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.full')};
  font-size: 10px;
  font-weight: ${tkn('typography.fontWeight.bold')};
  background: ${(props) => (props.$variant === 'success' ? tkn('colors.semantic.success')(props) : tkn('colors.brand.primary')(props))};
  color: ${tkn('colors.text.inverse')};
`;

export const SidebarFooter = styled.div`
  padding: ${tkn('spacing.md')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;

export const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const AvatarImage = styled.img`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${tkn('radius.full')};
  border: 1px solid ${tkn('colors.border.secondary')};
  object-fit: cover;
`;

export const UserInfo = styled.div`
  flex: 1;
  overflow: hidden;
`;

export const UserName = styled.p`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const UserRole = styled.p`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
`;

export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
`;

export const HeaderContainer = styled.header`
  height: ${tkn('spacing.xxxl')}; /* h-16 = 4rem */
  background: ${tkn('colors.background.secondary')};
  backdrop-filter: blur(8px);
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${tkn('spacing.xl')}; /* px-8 */
  position: sticky;
  top: 0;
  z-index: 99;
`;

export const BreadcrumbArea = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  font-size: ${tkn('typography.fontSize.sm')};
`;

export const BreadcrumbItem = styled.span<{ $active?: boolean }>`
  color: ${(props) => (props.$active ? tkn('colors.text.primary')(props) : tkn('colors.text.secondary')(props))};
  font-weight: ${(props) => (props.$active ? tkn('typography.fontWeight.medium')(props) : tkn('typography.fontWeight.normal')(props))};
`;

export const Separator = styled.span`
  color: ${tkn('colors.text.secondary')};
`;

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const NotificationButton = styled.button`
  position: relative;
  padding: ${tkn('spacing.sm')};
  color: ${tkn('colors.text.secondary')};
  border-radius: ${tkn('radius.full')};
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.secondary')}; /* lighter slate */
    color: ${tkn('colors.text.primary')};
  }
`;

export const NotificationDot = styled.span`
  position: absolute;
  top: ${tkn('spacing.sm')};
  right: ${tkn('spacing.sm')};
  width: ${tkn('spacing.sm')};
  height: ${tkn('spacing.sm')};
  background: ${tkn('colors.semantic.error')};
  border-radius: ${tkn('radius.full')};
`;

export const ActionIconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.background.primary')};
  color: ${tkn('colors.text.secondary')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.secondary')};
    color: ${tkn('colors.text.primary')};
    border-color: ${tkn('colors.border.primary')};
  }
`;

export const LanguageWrapper = styled.div`
  position: relative;
`;

export const DropdownMenu = styled.div<{ $isOpen: boolean }>`
  position: absolute;
  top: calc(100% + ${tkn('spacing.xs')});
  right: 0;
  min-width: 120px;
  background: ${tkn('colors.background.primary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('shadows.lg')};
  padding: ${tkn('spacing.xs')};
  display: ${({ $isOpen }) => ($isOpen ? 'flex' : 'none')};
  flex-direction: column;
  z-index: 1000;
  animation: fadeIn 0.15s ease-out;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export const DropdownItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  width: 100%;
  border: none;
  background: ${({ $active, theme }) => ($active ? tkn('colors.brand.secondary')({ theme }) : 'transparent')};
  color: ${({ $active, theme }) => ($active ? tkn('colors.brand.primary')({ theme }) : tkn('colors.text.primary')({ theme }))};
  border-radius: ${tkn('radius.sm')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${({ $active, theme }) => ($active ? tkn('colors.brand.secondary')({ theme }) : tkn('colors.background.secondary')({ theme }))};
  }
`;


export const ContentArea = styled.main`
  padding: 0;
  flex: 1;
`;
