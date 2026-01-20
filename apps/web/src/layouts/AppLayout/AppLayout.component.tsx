import { Button, ConfirmModal, Dropdown, Icon, Modal, Text, useTheme, useUI } from '@repo/ui';
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
  const [listingsOpen, setListingsOpen] = useState(location.pathname.startsWith('/listings'));
  const [settingsOpen, setSettingsOpen] = useState(location.pathname.startsWith('/settings'));
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const userName = user ? `${user.firstName} ${user.lastName}` : 'Guest User';

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
              <Icon name="bolt" size={24} color="white" />
            </S.LogoBox>
            {!sidebarCollapsed && (
              <Text variant="h3" weight="bold" color="brand.primary">
                Zonds
              </Text>
            )}
          </S.LogoArea>
          
          <S.NavSection>
            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
              {t('translation:menu.main')}
            </S.NavLabelWrapper>
            
            <S.NavItem 
              $active={location.pathname === '/dashboard'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => navigate('/dashboard')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="dashboard" size={18} />
                {!sidebarCollapsed && t('translation:menu.dashboard')}
              </S.NavItemContent>
            </S.NavItem>
            
            <S.NavItemWrapper>
              <S.NavItem 
                $active={location.pathname.startsWith('/listings')}
                $isCollapsed={sidebarCollapsed}
                onClick={() => {
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                  setListingsOpen(!listingsOpen);
                }}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="list-alt" size={18} />
                  {!sidebarCollapsed && t('translation:menu.listings')}
                </S.NavItemContent>
                {!sidebarCollapsed && (
                  <S.ChevronWrapper $isOpen={listingsOpen} $isCollapsed={sidebarCollapsed}>
                    <Icon name="expand-more" size={16} />
                  </S.ChevronWrapper>
                )}
              </S.NavItem>

              <S.SubNavContainer $isOpen={!sidebarCollapsed && listingsOpen}>
                <S.SubNavItem 
                  $active={location.pathname === '/listings'} 
                  onClick={() => navigate('/listings')}
                >
                  {t('translation:menu.ebayListings')}
                </S.SubNavItem>
                <S.SubNavItem 
                  $active={location.pathname === '/listings/jobs'} 
                  onClick={() => navigate('/listings/jobs')}
                >
                  {t('translation:menu.listingJobs')}
                </S.SubNavItem>
                <S.SubNavItem 
                  $active={location.pathname === '/listings/products'} 
                  onClick={() => navigate('/listings/products')}
                >
                  {t('translation:menu.products')}
                </S.SubNavItem>
              </S.SubNavContainer>
            </S.NavItemWrapper>
            
            
            <S.NavItem 
              $isCollapsed={sidebarCollapsed} 
              $active={location.pathname === '/orders'}
              onClick={() => navigate('/orders')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="shopping-cart" size={18} />
                {!sidebarCollapsed && t('translation:menu.orders')}
              </S.NavItemContent>
              {!sidebarCollapsed && <S.BadgeWrapper variant="primary" size="sm">12</S.BadgeWrapper>}
            </S.NavItem>
            
            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
              {t('translation:menu.configuration')}
            </S.NavLabelWrapper>
            
            <S.NavItemWrapper>
              <S.NavItem 
                $active={location.pathname.startsWith('/settings')}
                $isCollapsed={sidebarCollapsed}
                onClick={() => {
                  if (sidebarCollapsed) setSidebarCollapsed(false);
                  setSettingsOpen(!settingsOpen);
                }}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="settings" size={18} />
                  {!sidebarCollapsed && t('translation:menu.settings')}
                </S.NavItemContent>
                {!sidebarCollapsed && (
                  <S.ChevronWrapper $isOpen={settingsOpen} $isCollapsed={sidebarCollapsed}>
                    <Icon name="expand-more" size={16} />
                  </S.ChevronWrapper>
                )}
              </S.NavItem>
              
              <S.SubNavContainer $isOpen={!sidebarCollapsed && settingsOpen}>
                <S.SubNavItem 
                  $active={location.pathname === '/settings/store'} 
                  onClick={() => navigate('/settings/store')}
                >
                  {t('translation:menu.storeSettings')}
                </S.SubNavItem>
                <S.SubNavItem 
                  $active={location.pathname.startsWith('/settings/listing-groups')} 
                  onClick={() => navigate('/settings/listing-groups')}
                >
                  {t('translation:menu.listingSettingsGroups')}
                </S.SubNavItem>
              </S.SubNavContainer>
            </S.NavItemWrapper>
          </S.NavSection>

          <S.SidebarFooter>
            <Dropdown
              align="left"
              direction="up"
              width="240px"
              trigger={
                <S.ProfileSwitcher $isCollapsed={sidebarCollapsed}>
                  <S.ProfileBadge>
                    {user?.firstName?.charAt(0) || 'D'}{user?.lastName?.charAt(0) || 'U'}
                  </S.ProfileBadge>
                  {!sidebarCollapsed && (
                    <>
                      <S.ProfileDetails>
                        <Text variant="caption" weight="bold" color="text.primary">
                          {userName}
                        </Text>
                        <Text variant="caption" color="text.tertiary">
                          {user?.email || 'admin@zonds.com'}
                        </Text>
                      </S.ProfileDetails>
                      <S.ActionIcon as="div">
                        <Icon name="chevron-up" size={16} />
                      </S.ActionIcon>
                    </>
                  )}
                </S.ProfileSwitcher>
              }
              items={[
                {
                  label: t('translation:menu.editProfile'),
                  icon: 'user',
                  onClick: () => navigate('/profile')
                },
                {
                  label: t('translation:menu.logout'),
                  icon: 'log-out',
                  variant: 'danger',
                  onClick: () => setIsLogoutConfirmOpen(true)
                }
              ]}
            />
          </S.SidebarFooter>
        </S.SidebarContainer>

        {/* Main Content Area */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderInner>
              <S.HeaderLeft>
                 <S.MobileMenuButton 
                    onClick={() => setMobileSidebarOpen(true)}
                 >
                    <Icon name="menu" size={24} />
                 </S.MobileMenuButton>

                <S.BreadcrumbArea>
                   {location.pathname.startsWith('/listings') ? (
                     <>
                        <span className="hoverable" onClick={() => navigate('/listings')}>{t('translation:menu.listings')}</span>
                        <Icon name="chevron_right" size={16} />
                        <span className="active">
                          {location.pathname === '/listings' && t('translation:menu.ebayListings')}
                          {location.pathname === '/listings/jobs' && t('translation:menu.listingJobs')}
                          {location.pathname === '/listings/products' && t('translation:menu.products')}
                          {location.pathname === '/listings/add' && t('listings:breadcrumb.addProducts')}
                        </span>
                     </>
                   ) : (
                     <>
                        <span><Icon name="home" size={16} /></span>
                        <Icon name="chevron_right" size={16} />
                        <span>{t('translation:menu.settings')}</span>
                        <Icon name="chevron_right" size={16} />
                        <span className="active">
                            {location.pathname.includes('/settings/store') ? t('translation:menu.storeSettings') : t('translation:menu.listingSettingsGroups')}
                        </span>
                     </>
                   )}
                </S.BreadcrumbArea>
              </S.HeaderLeft>
              
              <S.HeaderRight>
                <S.ActionIcon onClick={toggleTheme} title={t('translation:header.toggleTheme')}>
                  <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={20} />
                </S.ActionIcon>

                <S.ActionIcon title={t('translation:header.notifications')}>
                  <Icon name="bell" size={20} />
                  <S.NotificationBadge />
                </S.ActionIcon>

                <S.VerticalDivider />

                <Dropdown 
                  align="right"
                  width="100px"
                  trigger={
                    <S.LanguageSelectTrigger title={t('translation:header.selectLanguage')}>
                      <S.LanguageText>{i18n.language.toUpperCase()}</S.LanguageText>
                      <Icon name="chevron_down" size={12} />
                    </S.LanguageSelectTrigger>
                  }
                  items={[
                    { 
                      label: 'English', 
                      onClick: () => i18n.changeLanguage('en') 
                    },
                    { 
                      label: 'Türkçe', 
                      onClick: () => i18n.changeLanguage('tr') 
                    }
                  ]}
                />

                <S.VerticalDivider />
              </S.HeaderRight>
            </S.HeaderInner>
          </S.HeaderContainer>

          <S.ContentArea>
            <S.ContentInner>
              <Outlet />
            </S.ContentInner>
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
                <Button onClick={closeMessage}>{t('translation:common.ok')}</Button>
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
          title={t('translation:menu.logoutConfirmTitle')}
          description={t('translation:menu.logoutConfirmDescription')}
          confirmLabel={t('translation:menu.logoutConfirmButton')}
          cancelLabel={t('translation:common.cancel')}
          variant="danger"
        />
      </S.LayoutWrapper>
    </ErrorBoundary>
  );
};

AppLayout.displayName = 'AppLayout';
