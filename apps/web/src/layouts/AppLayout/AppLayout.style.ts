import { Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const LayoutWrapper = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: ${({ theme }: { theme: Theme }) => tkn('colors.background.primary')({ theme })};
`;

export const SidebarContainer = styled.aside<{ $isOpen: boolean; $isCollapsed: boolean }>`
  width: ${(props) => (props.$isCollapsed ? '80px' : '280px')};
  background: ${({ theme }: { theme: Theme }) => tkn('colors.background.secondary')({ theme })};
  color: ${({ theme }: { theme: Theme }) => tkn('colors.text.primary')({ theme })};
  transition: all ${({ theme }: { theme: Theme }) => tkn('transitions.normal')({ theme })};
  display: flex;
  flex-direction: column;
  z-index: 999;
  border-right: 1px solid ${({ theme }: { theme: Theme }) => tkn('colors.border.primary')({ theme })};
  
  @media (max-width: 1024px) {
    position: fixed;
    height: 100vh;
    left: ${(props) => (props.$isOpen ? '0' : '-280px')};
    width: 280px;
  }
`;

export const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
`;

export const HeaderContainer = styled.header`
  height: 80px;
  background: ${({ theme }: { theme: Theme }) => tkn('colors.surface.primary')({ theme })};
  border-bottom: 1px solid ${({ theme }: { theme: Theme }) => tkn('colors.border.primary')({ theme })};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }: { theme: Theme }) => tkn('spacing.xl')({ theme })};
  position: sticky;
  top: 0;
  z-index: 99;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

export const ContentArea = styled.main`
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
  width: 100%;
  flex: 1;
`;

export const LogoArea = styled.div`
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.xl')({ theme })};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};
  font-size: ${({ theme }: { theme: Theme }) => tkn('typography.fontSize.xxl')({ theme })};
  font-weight: ${({ theme }: { theme: Theme }) => tkn('typography.fontWeight.bold')({ theme })};
  color: ${({ theme }: { theme: Theme }) => tkn('colors.text.primary')({ theme })};
`;

export const NavSection = styled.nav`
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })} ${({ theme }: { theme: Theme }) => tkn('spacing.xl')({ theme })};
  flex: 1;
`;

export const NavGroup = styled.div`
  margin-bottom: ${({ theme }: { theme: Theme }) => tkn('spacing.xl')({ theme })};
`;

export const NavLabel = styled.h3`
  font-size: ${({ theme }: { theme: Theme }) => tkn('typography.fontSize.xs')({ theme })};
  font-weight: ${({ theme }: { theme: Theme }) => tkn('typography.fontWeight.semibold')({ theme })};
  color: ${({ theme }: { theme: Theme }) => tkn('colors.text.tertiary')({ theme })};
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
`;

export const NavItem = styled.div<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })} ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.md')({ theme })};
  color: ${(props) => (props.$active ? tkn('colors.text.inverse')(props as any) : tkn('colors.text.secondary')(props as any))};
  color: ${(props) => (props.$active ? '#FFFFFF' : tkn('colors.text.secondary')(props as any))};
  background: ${(props) => (props.$active ? tkn('colors.brand.primary')(props as any) : 'transparent')};
  cursor: pointer;
  transition: all ${({ theme }: { theme: Theme }) => tkn('transitions.fast')({ theme })};
  margin-bottom: ${({ theme }: { theme: Theme }) => tkn('spacing.xs')({ theme })};

  &:hover {
    background: ${(props) => (props.$active ? tkn('colors.brand.primary')(props as any) : 'rgba(255, 255, 255, 0.05)')};
    color: #FFFFFF;
  }
`;

export const NavItemContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
`;

export const Badge = styled.span<{ $variant?: 'primary' | 'success' }>`
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  background: ${(props) => (props.$variant === 'success' ? '#219653' : tkn('colors.brand.primary')(props as any))};
  color: #FFFFFF;
`;

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
`;

export const SearchWrapper = styled.div`
  position: relative;
  width: 400px;
  
  @media (max-width: 1024px) {
    display: none;
  }
`;

export const SearchInput = styled.input`
  width: 100%;
  background: transparent;
  border: none;
  padding: 10px 45px;
  color: ${({ theme }: { theme: Theme }) => tkn('colors.text.primary')({ theme })};
  font-size: 14px;
  
  &:focus {
    outline: none;
  }
`;

export const SearchIconWrapper = styled.div`
  position: absolute;
  left: 15px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ theme }: { theme: Theme }) => tkn('colors.text.secondary')({ theme })};
`;


export const UserMenu = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
  cursor: pointer;
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.xs')({ theme })} ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.md')({ theme })};
  
  &:hover {
    background: ${({ theme }: { theme: Theme }) => tkn('colors.background.secondary')({ theme })};
  }
`;

export const Avatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.full')({ theme })};
  background: ${({ theme }: { theme: Theme }) => tkn('colors.brand.primary')({ theme })};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  overflow: hidden;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const Dropdown = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  width: 200px;
  background: ${({ theme }: { theme: Theme }) => tkn('colors.surface.primary')({ theme })};
  border: 1px solid ${({ theme }: { theme: Theme }) => tkn('colors.border.primary')({ theme })};
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.md')({ theme })};
  box-shadow: ${({ theme }: { theme: Theme }) => tkn('shadows.lg')({ theme })};
  margin-top: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};
`;

export const DropdownItem = styled.div`
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })} ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.sm')({ theme })};
  color: ${({ theme }: { theme: Theme }) => tkn('colors.text.secondary')({ theme })};
  cursor: pointer;
  transition: all ${({ theme }: { theme: Theme }) => tkn('transitions.fast')({ theme })};
  display: flex;
  align-items: center;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};

  &:hover {
    background: ${({ theme }: { theme: Theme }) => tkn('colors.background.secondary')({ theme })};
    color: ${({ theme }: { theme: Theme }) => tkn('colors.text.primary')({ theme })};
  }
`;

export const LanguageSwitcher = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};
  cursor: pointer;
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.xs')({ theme })} ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.md')({ theme })};
  transition: all ${({ theme }: { theme: Theme }) => tkn('transitions.fast')({ theme })};

  &:hover {
    background: ${({ theme }: { theme: Theme }) => tkn('colors.background.secondary')({ theme })};
  }
`;

export const FlagIcon = styled.span`
  font-size: 20px;
  display: flex;
  align-items: center;
`;

export const SidebarToggleButton = styled.button`
  background: transparent;
  border: none;
  color: ${({ theme }: { theme: Theme }) => tkn('colors.text.primary')({ theme })};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.xs')({ theme })};
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.sm')({ theme })};
  
  &:hover {
    background: ${({ theme }: { theme: Theme }) => tkn('colors.background.secondary')({ theme })};
  }
`;

