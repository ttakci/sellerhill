import { Badge, GeneralLoading, GeneralMessage, Icon, Text, useTheme, useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useTranslation } from 'react-i18next';
import * as S from './AppLayout.style';

/**
 * TailAdmin Inspired Layout - Fully Responsive Design
 * Features a collapsible sidebar for desktop and overlay sidebar for mobile.
 */
export const AppLayout: React.FC = () => {
  const { messageState, loadingState, closeMessage } = useUI();
  const { themeMode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useGetMeQuery();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith('/settings'));

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const userName = user ? `${user.firstName} ${user.lastName}` : 'Guest User';
  const userRole = 'Store Admin';

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <ErrorBoundary>
      <S.LayoutWrapper>
        {/* Mobile Sidebar Overlay */}
        <S.SidebarOverlay 
            $isOpen={mobileSidebarOpen} 
            onClick={() => setMobileSidebarOpen(false)} 
        />

        {/* Sidebar */}
        <S.SidebarContainer 
            $isCollapsed={sidebarCollapsed} 
            $isMobileOpen={mobileSidebarOpen}
        >
          <S.LogoArea $isCollapsed={sidebarCollapsed} onClick={() => navigate('/dashboard')}>
            <S.LogoBox>
              <Icon name="inbox" size={20} color="text.inverse" />
            </S.LogoBox>
            {!sidebarCollapsed && (
              <Text variant="h3" weight="bold" color="brand.primary">
                Zonds
              </Text>
            )}
          </S.LogoArea>
          
          <S.NavSection>
            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
              <Text variant="caption" weight="bold" muted>
                {t('menu.main')}
              </Text>
            </S.NavLabelWrapper>
            
            <S.NavItem 
              $active={location.pathname === '/dashboard'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => navigate('/dashboard')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="inbox" size={20} />
                {!sidebarCollapsed && <Text variant="body">{t('menu.dashboard')}</Text>}
              </S.NavItemContent>
              {!sidebarCollapsed && (
                <S.ChevronWrapper $isOpen={false} $isCollapsed={sidebarCollapsed}>
                  <Icon name="chevron-down" size={14} />
                </S.ChevronWrapper>
              )}
            </S.NavItem>

            <S.NavItem 
              $isCollapsed={sidebarCollapsed} 
              $active={location.pathname === '/inventory'}
              onClick={() => navigate('/inventory')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="archive" size={20} />
                {!sidebarCollapsed && <Text variant="body">{t('menu.inventory')}</Text>}
              </S.NavItemContent>
              {!sidebarCollapsed && <Badge variant="success" size="sm">NEW</Badge>}
            </S.NavItem>

            <S.NavItem 
              $isCollapsed={sidebarCollapsed} 
              $active={location.pathname === '/orders'}
              onClick={() => navigate('/orders')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="calendar" size={20} />
                {!sidebarCollapsed && <Text variant="body">{t('menu.orders')}</Text>}
              </S.NavItemContent>
              {!sidebarCollapsed && <Badge variant="primary" size="sm">12</Badge>}
            </S.NavItem>

            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
              <Text variant="caption" weight="bold" muted>
                {t('menu.configuration')}
              </Text>
            </S.NavLabelWrapper>
            
            <S.NavItemWrapper>
              <S.NavItem 
                $active={location.pathname.startsWith('/settings')}
                $isCollapsed={sidebarCollapsed}
                onClick={() => {
                  if (sidebarCollapsed) {
                    setSidebarCollapsed(false);
                  }
                  setSettingsOpen(!settingsOpen);
                }}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="menu" size={20} />
                  {!sidebarCollapsed && <Text variant="body">{t('menu.settings')}</Text>}
                </S.NavItemContent>
                {!sidebarCollapsed && (
                  <S.ChevronWrapper $isOpen={settingsOpen} $isCollapsed={sidebarCollapsed}>
                    <Icon name="chevron-down" size={14} />
                  </S.ChevronWrapper>
                )}
              </S.NavItem>

              {!sidebarCollapsed && (
                <S.SubNavContainer $isOpen={settingsOpen}>
                  <S.SubNavItem 
                    $active={location.pathname === '/settings/store'} 
                    onClick={() => navigate('/settings/store')}
                  >
                    <Text variant="caption">
                      {t('menu.storeSettings')}
                    </Text>
                  </S.SubNavItem>
                  <S.SubNavItem 
                    $active={location.pathname === '/settings/ebay'}
                    onClick={() => navigate('/settings/ebay')}
                  >
                    <Text variant="caption">eBay Accounts</Text>
                  </S.SubNavItem>
                </S.SubNavContainer>
              )}
            </S.NavItemWrapper>

            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
              <Text variant="caption" weight="bold" muted>
                {t('menu.other')}
              </Text>
            </S.NavLabelWrapper>
            
            <S.NavItem 
              $isCollapsed={sidebarCollapsed} 
              $active={location.pathname === '/reports'}
              onClick={() => navigate('/reports')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="bell" size={20} />
                {!sidebarCollapsed && <Text variant="body">{t('menu.reports')}</Text>}
              </S.NavItemContent>
            </S.NavItem>
          </S.NavSection>
        </S.SidebarContainer>

        {/* Main Content Area */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderLeft>
              <S.ToggleButton onClick={handleToggleSidebar}>
                <Icon name="menu" size={20} />
              </S.ToggleButton>
              
              <S.SearchArea>
                <Icon name="search" size={18} />
                <S.SearchInput placeholder="Search or type command..." />
                <S.Kbd>⌘K</S.Kbd>
              </S.SearchArea>
            </S.HeaderLeft>
            
            <S.HeaderRight>
              <S.ActionIcon onClick={toggleTheme} title="Toggle Theme">
                <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={18} />
              </S.ActionIcon>
              
              <S.ActionIcon title="Notifications">
                <Icon name="bell" size={18} />
              </S.ActionIcon>
              
              <S.ProfileArea onClick={() => navigate('/logout')}>
                <S.ProfileInfo>
                  <Text variant="caption" weight="bold" color="text.primary">
                    {userName}
                  </Text>
                  <Text variant="caption" color="text.tertiary">
                    {userRole}
                  </Text>
                </S.ProfileInfo>
                <S.AvatarWrapper>
                  <S.AvatarImg src={`https://ui-avatars.com/api/?name=${userName}&background=3b82f6&color=ffffff`} alt="Profile" />
                </S.AvatarWrapper>
                <Icon name="chevron-down" size={14} />
              </S.ProfileArea>
            </S.HeaderRight>
          </S.HeaderContainer>

          <S.ContentArea>
            <Outlet />
          </S.ContentArea>
        </S.MainContent>
      </S.LayoutWrapper>

      {/* Global Loading Overlay */}
      {loadingState.isLoading && (
        <GeneralLoading isLoading={loadingState.isLoading} size={loadingState.size} overlay={loadingState.overlay} />
      )}

      {/* Global Message Modal */}
      {messageState.isOpen && (
        <GeneralMessage
          type={messageState.type}
          isOpen={messageState.isOpen}
          header={messageState.header}
          description={messageState.description}
          primaryButton={messageState.primaryButton}
          secondaryButton={messageState.secondaryButton}
          onClose={closeMessage}
        />
      )}
    </ErrorBoundary>
  );
};

AppLayout.displayName = 'AppLayout';
