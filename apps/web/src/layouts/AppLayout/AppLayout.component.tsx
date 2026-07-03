import { type SupportedLocale, type UserDto } from '@repo/shared';
import {
  Breadcrumb,
  BreadcrumbItem,
  ConfirmModal,
  Dropdown,
  Icon,
  Logo,
  MeshBackground,
  Text,
  useTheme,
  useUI,
} from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation } from 'react-router-dom';


import { stripLocaleFromPath } from '../../utils/locale';
import { type UseLocaleReturn, useLocale } from '../../utils/useLocale';

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
  const { loadingState } = useUI();
  const { themeMode, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation(['translation', 'listings', 'orders']);
  const { locale: _locale, localeNavigate, changeLocale }: UseLocaleReturn = useLocale();
  const location = useLocation();

  // Strip locale prefix for path comparisons
  const pathWithoutLocale: string = stripLocaleFromPath(location.pathname);

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

  const handleNavigate = useCallback(
    (path: string) => {
      localeNavigate(path);
    },
    [localeNavigate]
  );

  const handleLogout = useCallback(() => {
    onLogout();
    localeNavigate('/login');
    setIsLogoutConfirmOpen(false);
  }, [onLogout, localeNavigate, setIsLogoutConfirmOpen]);

  const handleChangeLanguage = useCallback(
    (lang: string) => {
      changeLocale(lang as SupportedLocale);
    },
    [changeLocale]
  );

  const getBreadcrumbItems = () => {
    const items: BreadcrumbItem[] = [{ label: '', path: '/dashboard', icon: 'home' }];

    if (pathWithoutLocale === '/dashboard' || pathWithoutLocale === '/') {
      return items;
    }

    if (pathWithoutLocale.startsWith('/listings')) {
      items.push({ label: t('translation:menu.listings'), path: '/listings' });
      if (pathWithoutLocale === '/listings/jobs') {
        items.push({ label: t('translation:menu.listingJobs') });
      } else if (pathWithoutLocale === '/listings/products') {
        items.push({ label: t('translation:menu.products') });
      } else if (pathWithoutLocale === '/listings/add') {
        items.push({ label: t('listings:listings.breadcrumb.addProducts') });
      } else if (pathWithoutLocale === '/listings') {
        items.push({ label: t('translation:menu.ebayListings') });
      }
    } else if (pathWithoutLocale.startsWith('/orders')) {
      items.push({ label: t('translation:menu.orders'), path: '/orders' });
      if (pathWithoutLocale !== '/orders') {
        items.push({ label: t('orders:orders.detail.title') });
      }
    } else if (pathWithoutLocale.startsWith('/settings') || pathWithoutLocale.startsWith('/listing-settings-groups')) {
      items.push({ label: t('translation:menu.settings'), path: '/settings/store' });
      if (pathWithoutLocale.includes('/settings/store')) {
        items.push({ label: t('translation:menu.storeSettings') });
      } else if (pathWithoutLocale.includes('/settings/amazon-accounts')) {
        items.push({ label: t('translation:menu.amazonAccounts') });
      } else {
        items.push({ label: t('translation:menu.listingSettingsGroups') });
      }
    } else if (pathWithoutLocale === '/stores') {
      items.push({ label: t('translation:menu.stores') });
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
          <S.LogoArea $isCollapsed={sidebarCollapsed} onClick={() => localeNavigate('/dashboard')}>
            {sidebarCollapsed ? <Logo size={32} /> : <Logo layout="stacked" />}
          </S.LogoArea>

          <S.NavSection>
            {/* INVENTORY section */}
            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
              {t('translation:menu.inventory')}
            </S.NavLabelWrapper>

            <S.NavItem
              $active={pathWithoutLocale === '/dashboard'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => localeNavigate('/dashboard')}
              title={sidebarCollapsed ? t('translation:menu.dashboard') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="dashboard" size={18} />
                {!sidebarCollapsed && t('translation:menu.dashboard')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavItem
              $active={pathWithoutLocale === '/listings'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => localeNavigate('/listings')}
              title={sidebarCollapsed ? t('translation:menu.ebayListings') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="storefront" size={18} />
                {!sidebarCollapsed && t('translation:menu.ebayListings')}
              </S.NavItemContent>
              {!sidebarCollapsed && (
                <S.BadgeWrapper variant="primary" size="sm">
                  20
                </S.BadgeWrapper>
              )}
            </S.NavItem>

            <S.NavItem
              $active={pathWithoutLocale === '/listings/jobs'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => localeNavigate('/listings/jobs')}
              title={sidebarCollapsed ? t('translation:menu.listingJobs') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="bolt" size={18} />
                {!sidebarCollapsed && t('translation:menu.listingJobs')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavItem
              $active={pathWithoutLocale === '/listings/products'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => localeNavigate('/listings/products')}
              title={sidebarCollapsed ? t('translation:menu.products') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="inventory-2" size={18} />
                {!sidebarCollapsed && t('translation:menu.products')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavItem
              $isCollapsed={sidebarCollapsed}
              $active={pathWithoutLocale === '/orders'}
              onClick={() => localeNavigate('/orders')}
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

            <S.NavItem
              $isCollapsed={sidebarCollapsed}
              $active={pathWithoutLocale === '/stores'}
              onClick={() => localeNavigate('/stores')}
              title={sidebarCollapsed ? t('translation:menu.stores') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="storefront" size={18} />
                {!sidebarCollapsed && t('translation:menu.stores')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavDivider />

            {/* CONFIGURATION section */}
            <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
              {t('translation:menu.configuration')}
            </S.NavLabelWrapper>

            <S.NavItem
              $active={pathWithoutLocale.startsWith('/settings') || pathWithoutLocale === '/profile'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => localeNavigate('/settings/store')}
              title={sidebarCollapsed ? t('translation:menu.settings') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="settings" size={18} />
                {!sidebarCollapsed && t('translation:menu.settings')}
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
                  onClick: () => localeNavigate('/profile'),
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
