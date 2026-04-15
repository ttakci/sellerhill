import { type UserDto } from '@repo/shared';
import {
  Breadcrumb,
  BreadcrumbItem,
  ConfirmModal,
  Dropdown,
  Icon,
  Logo,
  MeshBackground,
  MessageModal,
  Text,
  useTheme,
  useUI,
} from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import * as S from './AppLayout.style';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';

interface AppLayoutProps {
  user?: UserDto;
  onLogout: () => void;
}

/**
 * TailAdmin Inspired Layout - Fully Responsive Design
 * Features a collapsible sidebar for desktop and overlay sidebar for mobile.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ user, onLogout }) => {
  const { messageState, loadingState, closeMessage } = useUI();
  const { themeMode, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation(['translation', 'listings', 'orders']);
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMobileSidebarOpen(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [location.pathname]);

  const userName = user ? `${user.firstName} ${user.lastName}` : t('translation:common.notSet');

  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, []);

  const handleNavigate = useCallback((path: string) => {
    void navigate(path);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    onLogout();
    void navigate('/login');
    setIsLogoutConfirmOpen(false);
  }, [onLogout, navigate]);

  const handleChangeLanguage = useCallback((lang: string) => {
    void i18n.changeLanguage(lang);
  }, [i18n]);

  const getBreadcrumbItems = () => {
    const items: BreadcrumbItem[] = [{ label: '', path: '/dashboard', icon: 'home' }];

    if (location.pathname === '/dashboard' || location.pathname === '/') {
      return items;
    }

    if (location.pathname.startsWith('/listings')) {
      items.push({ label: t('translation:menu.listings'), path: '/listings' });
      if (location.pathname === '/listings/jobs') {
        items.push({ label: t('translation:menu.listingJobs') });
      } else if (location.pathname === '/listings/products') {
        items.push({ label: t('translation:menu.products') });
      } else if (location.pathname === '/listings/add') {
        items.push({ label: t('listings:listings.breadcrumb.addProducts') });
      } else if (location.pathname === '/listings') {
        items.push({ label: t('translation:menu.ebayListings') });
      }
    } else if (location.pathname.startsWith('/orders')) {
      items.push({ label: t('translation:menu.orders'), path: '/orders' });
      if (location.pathname !== '/orders') {
        items.push({ label: t('orders:orders.detail.title') });
      }
    } else if (location.pathname.startsWith('/settings') || location.pathname.startsWith('/listing-settings-groups')) {
      items.push({ label: t('translation:menu.settings'), path: '/settings/store' });
      if (location.pathname.includes('/settings/store')) {
        items.push({ label: t('translation:menu.storeSettings') });
      } else {
        items.push({ label: t('translation:menu.listingSettingsGroups') });
      }
    }
    return items;
  };

  return (
    <ErrorBoundary>
      <S.LayoutWrapper>
        {/* Mobile Sidebar Overlay */}
        <S.SidebarOverlay $isOpen={mobileSidebarOpen} onClick={() => setMobileSidebarOpen(false)} />

        {/* Sidebar */}
        <S.SidebarContainer $isCollapsed={sidebarCollapsed} $isMobileOpen={mobileSidebarOpen}>
          <MeshBackground animate={false} />
          <S.LogoArea $isCollapsed={sidebarCollapsed} onClick={() => void navigate('/dashboard')}>
            <Logo size={sidebarCollapsed ? 98 : 220} />
          </S.LogoArea>

          <S.NavSection>
            <S.NavItem
              $active={location.pathname === '/dashboard'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => void navigate('/dashboard')}
              title={sidebarCollapsed ? t('translation:menu.dashboard') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="dashboard" size={18} />
                {!sidebarCollapsed && t('translation:menu.dashboard')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavDivider />

            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>{t('translation:menu.inventory')}</S.NavLabelWrapper>

            <S.NavItemWrapper>
              <S.SubNavContainer $isOpen={true}>
                <S.NavItem
                  $active={location.pathname === '/listings'}
                  $isCollapsed={sidebarCollapsed}
                  $isSubItem={true}
                  onClick={() => void navigate('/listings')}
                  title={sidebarCollapsed ? t('translation:menu.ebayListings') : undefined}
                >
                  <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                    <Icon name="storefront" size={18} />
                    {!sidebarCollapsed && t('translation:menu.ebayListings')}
                  </S.NavItemContent>
                </S.NavItem>
                <S.NavItem
                  $active={location.pathname === '/listings/jobs'}
                  $isCollapsed={sidebarCollapsed}
                  $isSubItem={true}
                  onClick={() => void navigate('/listings/jobs')}
                  title={sidebarCollapsed ? t('translation:menu.listingJobs') : undefined}
                >
                  <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                    <Icon name="bolt" size={18} />
                    {!sidebarCollapsed && t('translation:menu.listingJobs')}
                  </S.NavItemContent>
                </S.NavItem>
                <S.NavItem
                  $active={location.pathname === '/listings/products'}
                  $isCollapsed={sidebarCollapsed}
                  $isSubItem={true}
                  onClick={() => void navigate('/listings/products')}
                  title={sidebarCollapsed ? t('translation:menu.products') : undefined}
                >
                  <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                    <Icon name="inventory-2" size={18} />
                    {!sidebarCollapsed && t('translation:menu.products')}
                  </S.NavItemContent>
                </S.NavItem>
              </S.SubNavContainer>
            </S.NavItemWrapper>

            <S.NavItem
              $isCollapsed={sidebarCollapsed}
              $active={location.pathname === '/orders'}
              onClick={() => void navigate('/orders')}
              title={sidebarCollapsed ? t('translation:menu.orders') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="inbox" size={18} />
                {!sidebarCollapsed && t('translation:menu.orders')}
              </S.NavItemContent>
              {!sidebarCollapsed && (
                <S.BadgeWrapper variant="primary" size="sm">
                  12
                </S.BadgeWrapper>
              )}
            </S.NavItem>

            <S.NavDivider />

            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>{t('translation:menu.settings')}</S.NavLabelWrapper>

            <S.NavItemWrapper>
              <S.SubNavContainer $isOpen={true}>
                <S.NavItem
                  $active={location.pathname === '/settings/store'}
                  $isCollapsed={sidebarCollapsed}
                  $isSubItem={true}
                  onClick={() => void navigate('/settings/store')}
                  title={sidebarCollapsed ? t('translation:menu.storeSettings') : undefined}
                >
                  <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                    <Icon name="settings" size={18} />
                    {!sidebarCollapsed && t('translation:menu.storeSettings')}
                  </S.NavItemContent>
                </S.NavItem>
                <S.NavItem
                  $active={location.pathname.startsWith('/settings/listing-groups')}
                  $isCollapsed={sidebarCollapsed}
                  $isSubItem={true}
                  onClick={() => void navigate('/settings/listing-groups')}
                  title={sidebarCollapsed ? t('translation:menu.listingSettingsGroups') : undefined}
                >
                  <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                    <Icon name="rule" size={18} />
                    {!sidebarCollapsed && t('translation:menu.listingSettingsGroups')}
                  </S.NavItemContent>
                </S.NavItem>
              </S.SubNavContainer>
            </S.NavItemWrapper>
          </S.NavSection>

          <S.SidebarFooter>
            <Dropdown
              align="left"
              direction="up"
              width="15rem" /* 240px */
              trigger={
                <S.ProfileSwitcher $isCollapsed={sidebarCollapsed}>
                  <S.ProfileBadge>
                    {user?.firstName?.charAt(0) || 'D'}
                    {user?.lastName?.charAt(0) || 'U'}
                  </S.ProfileBadge>
                  {!sidebarCollapsed && (
                    <>
                      <S.ProfileDetails>
                        <Text variant="caption" weight="bold" color="text.inverse">
                          {userName}
                        </Text>
                        <Text variant="caption" color="sidebar.textMuted">
                          {user?.email || ''}
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
                  onClick: () => void navigate('/profile'),
                },
                {
                  label: t('translation:menu.logout'),
                  icon: 'log-out',
                  variant: 'danger',
                  onClick: () => setIsLogoutConfirmOpen(true),
                },
              ]}
            />
          </S.SidebarFooter>
        </S.SidebarContainer>

        {/* Main Content Area */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderInner>
              <S.HeaderLeft>
                <S.MobileMenuButton onClick={handleToggleSidebar}>
                  <Icon name="menu" size={24} />
                </S.MobileMenuButton>

                <S.ToggleButton onClick={handleToggleSidebar}>
                  <Icon name="menu" size={20} />
                </S.ToggleButton>
              </S.HeaderLeft>

              <S.BreadcrumbArea>
                <Breadcrumb items={getBreadcrumbItems()} onNavigate={handleNavigate} />
              </S.BreadcrumbArea>

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
                  width="6.25rem" /* 100px */
                  trigger={
                    <S.LanguageSelectTrigger title={t('translation:header.selectLanguage')}>
                      <S.LanguageText>{i18n.language.toUpperCase()}</S.LanguageText>
                      <Icon name="chevron_down" size={12} />
                    </S.LanguageSelectTrigger>
                  }
                  items={[
                    {
                      label: t('translation:languages.en'),
                      onClick: () => handleChangeLanguage('en'),
                    },
                    {
                      label: t('translation:languages.tr'),
                      onClick: () => handleChangeLanguage('tr'),
                    },
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
          <Footer />
        </S.MainContent>

        {/* Global UI Overlays */}
        <S.LoadingOverlay $visible={loadingState.isLoading}>
          <Icon name="loader" size={48} />
        </S.LoadingOverlay>

        <MessageModal
          isOpen={messageState.isOpen}
          onClose={closeMessage}
          type={messageState.type}
          title={messageState.header}
          description={messageState.description}
          primaryButton={messageState.primaryButton || {
            label: t('translation:common.ok'),
            onClick: closeMessage,
            variant: messageState.type === 'error' ? 'danger' : 'primary',
          }}
          secondaryButton={messageState.secondaryButton || undefined}
        />
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
