import { Badge, Button, ConfirmModal, Dropdown, Icon, Modal, Text, useTheme, useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { logout } from '@/features/auth/store/authSlice';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import * as S from './AppLayout.style';

/**
 * TailAdmin Inspired Layout - Fully Responsive Design
 * Features a collapsible sidebar for desktop and overlay sidebar for mobile.
 */
export const AppLayout: React.FC = () => {
  const { messageState, loadingState, closeMessage } = useUI();
  const { themeMode, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
   const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const { data: user } = useGetMeQuery();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith('/settings'));
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

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

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    setIsLogoutConfirmOpen(false);
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
              <Icon name="logo" size={24} color="white" />
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
                <Icon name="grid" size={18} />
                {!sidebarCollapsed && t('menu.dashboard')}
              </S.NavItemContent>
              {!sidebarCollapsed && (
                <S.ChevronWrapper $isOpen={false} $isCollapsed={sidebarCollapsed}>
                  <Icon name="chevron-down" size={20} />
                </S.ChevronWrapper>
              )}
            </S.NavItem>

            <S.NavItem 
              $isCollapsed={sidebarCollapsed} 
              $active={location.pathname === '/listings'}
              onClick={() => navigate('/listings')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="upload" size={18} />
                {!sidebarCollapsed && t('menu.listings')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavItem 
              $isCollapsed={sidebarCollapsed} 
              $active={location.pathname === '/inventory'}
              onClick={() => navigate('/inventory')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="box" size={18} />
                {!sidebarCollapsed && t('menu.inventory')}
              </S.NavItemContent>
              {!sidebarCollapsed && <Badge variant="success" size="sm">NEW</Badge>}
            </S.NavItem>

            <S.NavItem 
              $isCollapsed={sidebarCollapsed} 
              $active={location.pathname === '/orders'}
              onClick={() => navigate('/orders')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="shopping-cart" size={18} />
                {!sidebarCollapsed && t('menu.orders')}
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
                  <Icon name="settings" size={18} />
                  {!sidebarCollapsed && t('menu.settings')}
                </S.NavItemContent>
                {!sidebarCollapsed && (
                  <S.ChevronWrapper $isOpen={settingsOpen} $isCollapsed={sidebarCollapsed}>
                    <Icon name="chevron-down" size={20} />
                  </S.ChevronWrapper>
                )}
              </S.NavItem>

              {!sidebarCollapsed && (
                <S.SubNavContainer $isOpen={settingsOpen}>
                  <S.SubNavItem 
                    $active={location.pathname === '/settings/store'} 
                    onClick={() => navigate('/settings/store')}
                  >
                    {t('menu.storeSettings')}
                  </S.SubNavItem>
                  <S.SubNavItem 
                    $active={location.pathname.startsWith('/settings/listing-groups')} 
                    onClick={() => navigate('/settings/listing-groups')}
                  >
                    {t('menu.listingSettingsGroups')}
                  </S.SubNavItem>
                </S.SubNavContainer>
              )}
            </S.NavItemWrapper>
          </S.NavSection>
        </S.SidebarContainer>

        {/* Main Content Area */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderLeft>
              <S.ToggleButton onClick={handleToggleSidebar}>
                <Icon name="menu" size={24} />
              </S.ToggleButton>
            </S.HeaderLeft>
            
            <S.HeaderRight>
              <Dropdown 
                align="right"
                trigger={
                  <S.ActionIcon title={t('header.selectLanguage')}>
                     <Icon name={i18n.language === 'tr' ? 'flag-tr' : 'flag-us'} size={22} />
                  </S.ActionIcon>
                }
                items={[
                  { 
                    label: t('languages.en'), 
                    icon: 'flag-us', 
                    onClick: () => i18n.changeLanguage('en') 
                  },
                  { 
                    label: t('languages.tr'), 
                    icon: 'flag-tr', 
                    onClick: () => i18n.changeLanguage('tr') 
                  }
                ]}
              />

              <S.ActionIcon onClick={toggleTheme} title={t('header.toggleTheme')}>
                <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={22} />
              </S.ActionIcon>
              
              <S.ActionIcon title={t('header.notifications')}>
                <Icon name="bell" size={22} />
                <S.NotificationBadge />
              </S.ActionIcon>
              
              <Dropdown
                align="right"
                trigger={(isOpen: boolean) => (
                  <S.ProfileArea>
                     <S.AvatarWrapper>
                      <S.AvatarImg src={`https://ui-avatars.com/api/?name=${userName}&background=3b82f6&color=ffffff`} alt="Profile" />
                    </S.AvatarWrapper>
                    <S.ProfileInfo>
                      <Text variant="caption" weight="bold" color="text.primary">
                        {userName}
                      </Text>
                      <Text variant="caption" color="text.tertiary">
                        {userRole}
                      </Text>
                    </S.ProfileInfo>
                    <S.ChevronWrapper $isOpen={isOpen} $isCollapsed={false}>
                      <Icon name="chevron-down" size={20} />
                    </S.ChevronWrapper>
                  </S.ProfileArea>
                )}
                header={
                   <S.DropdownHeaderWrapper>
                     <S.PageTitle variant="body" weight="bold" color="text.primary">{userName}</S.PageTitle>
                     <Text variant="caption" color="text.tertiary">{user?.email ?? 'user@example.com'}</Text>
                   </S.DropdownHeaderWrapper>
                }
                items={[
                  { label: t('menu.editProfile'), icon: 'user', onClick: () => navigate('/profile') },
                  { label: t('profile.accountSettings'), icon: 'settings', onClick: () => navigate('/settings') },
                  { label: t('menu.support'), icon: 'info', onClick: () => console.log('Support') },
                   { label: t('menu.logout'), icon: 'log-out', variant: 'default', onClick: () => setIsLogoutConfirmOpen(true) }
                ]}
              />
            </S.HeaderRight>
          </S.HeaderContainer>

          <S.ContentArea>
            <Outlet />
          </S.ContentArea>
        </S.MainContent>
        
        {/* Global UI Overlays */}
        <S.LoadingOverlay $visible={loadingState.isLoading}>
          <Icon name="loader" size={48} />
        </S.LoadingOverlay>

        <Modal
          isOpen={messageState.isOpen}
          onClose={closeMessage}
          title={messageState.header}
          size="sm"
          footer={
            <S.ModalFooterWrapper>
              {messageState.secondaryButton && (
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    messageState.secondaryButton?.onClick();
                    closeMessage();
                  }}
                >
                  {messageState.secondaryButton.label}
                </Button>
              )}
              {messageState.primaryButton && (
                <Button 
                  variant={messageState.type === 'error' ? 'danger' : 'primary'}
                  onClick={() => {
                    messageState.primaryButton?.onClick();
                    closeMessage();
                  }}
                >
                  {messageState.primaryButton.label}
                </Button>
              )}
              {!messageState.primaryButton && !messageState.secondaryButton && (
                <Button onClick={closeMessage}>{t('common.ok')}</Button>
              )}
            </S.ModalFooterWrapper>
          }
        >
          <Text variant="body">{messageState.description}</Text>
        </Modal>
         <ConfirmModal
          isOpen={isLogoutConfirmOpen}
          onClose={() => setIsLogoutConfirmOpen(false)}
          onConfirm={handleLogout}
          title={t('auth.logout.confirmTitle')}
          description={t('auth.logout.confirmDescription')}
          confirmLabel={t('auth.logout.confirmButton')}
          cancelLabel={t('common.cancel')}
          variant="danger"
        />
      </S.LayoutWrapper>
    </ErrorBoundary>
  );
};

AppLayout.displayName = 'AppLayout';
