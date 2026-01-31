import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  ConfirmModal,
  Dropdown,
  Icon,
  Logo,
  MeshBackground,
  Modal,
  Text,
  useTheme,
  useUI,
} from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
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

  const userName = user ? `${user.firstName} ${user.lastName}` : t('translation:common.notSet');

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
        items.push({ label: t('listings:breadcrumb.addProducts') });
      } else if (location.pathname === '/listings') {
        items.push({ label: t('translation:menu.ebayListings') });
      }
    } else if (location.pathname.startsWith('/orders')) {
      items.push({ label: t('translation:menu.orders'), path: '/orders' });
      if (location.pathname !== '/orders') {
        items.push({ label: t('orders:detail.title') });
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
          <S.LogoArea $isCollapsed={sidebarCollapsed} onClick={() => navigate('/dashboard')}>
            <Logo size={sidebarCollapsed ? 98 : 220} />
          </S.LogoArea>

          <S.NavSection>
            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>{t('translation:menu.main')}</S.NavLabelWrapper>

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
                <S.SubNavItem $active={location.pathname === '/listings'} onClick={() => navigate('/listings')}>
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
              $active={location.pathname === '/inventory'}
              onClick={() => navigate('/inventory')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="archive" size={18} />
                {!sidebarCollapsed && t('translation:menu.inventory')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavItem
              $isCollapsed={sidebarCollapsed}
              $active={location.pathname === '/orders'}
              onClick={() => navigate('/orders')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="shopping-cart" size={18} />
                {!sidebarCollapsed && t('translation:menu.orders')}
              </S.NavItemContent>
              {!sidebarCollapsed && (
                <S.BadgeWrapper variant="primary" size="sm">
                  12
                </S.BadgeWrapper>
              )}
            </S.NavItem>

            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>{t('translation:menu.configuration')}</S.NavLabelWrapper>

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
            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>{t('translation:menu.other')}</S.NavLabelWrapper>

            <S.NavItem
              $isCollapsed={sidebarCollapsed}
              $active={location.pathname === '/reports'}
              onClick={() => navigate('/reports')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="insert-chart" size={18} />
                {!sidebarCollapsed && t('translation:menu.reports')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavItem
              $isCollapsed={sidebarCollapsed}
              $active={location.pathname === '/profile'}
              onClick={() => navigate('/profile')}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="user" size={18} />
                {!sidebarCollapsed && t('translation:menu.editProfile')}
              </S.NavItemContent>
            </S.NavItem>
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
                        <Text variant="caption" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
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
                  onClick: () => navigate('/profile'),
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
                  <Icon name={sidebarCollapsed ? 'menu_open' : 'menu'} size={20} />
                </S.ToggleButton>
              </S.HeaderLeft>

              <S.BreadcrumbArea>
                <Breadcrumb items={getBreadcrumbItems()} onNavigate={(path) => navigate(path)} />
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
                      onClick: () => i18n.changeLanguage('en'),
                    },
                    {
                      label: t('translation:languages.tr'),
                      onClick: () => i18n.changeLanguage('tr'),
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
            <Footer />
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
