import { Breadcrumb, ConfirmModal, Dropdown, Icon, Logo, MeshBackground, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import * as S from './AppLayout.style';
import type { AppLayoutProps } from './AppLayout.types';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';

// TODO(Plan 2 — Dashboard): wire to real RTK Query counts (eBay listings + pending orders)
const EBAY_LISTINGS_COUNT_PLACEHOLDER = 20;
const ORDERS_COUNT_PLACEHOLDER = 12;

/**
 * TailAdmin Inspired Layout - Fully Responsive Design
 * Features a collapsible sidebar for desktop and overlay sidebar for mobile.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  user,
  sidebarCollapsed,
  mobileSidebarOpen,
  isLogoutConfirmOpen,
  pathWithoutLocale,
  userName,
  loadingIsLoading,
  themeMode,
  breadcrumbItems,
  onToggleSidebar,
  onNavigate,
  onLogoutConfirm,
  onChangeLanguage,
  onToggleTheme,
  onCloseMobileSidebar,
  onOpenLogoutConfirm,
  onCloseLogoutConfirm,
  onLocaleNavigate,
  i18nLanguage,
}) => {
  const { t } = useTranslation(['translation', 'listings', 'orders']);

  return (
    <ErrorBoundary>
      <S.LayoutWrapper>
        {/* Mobile Sidebar Overlay */}
        <S.SidebarOverlay $isOpen={mobileSidebarOpen} onClick={onCloseMobileSidebar} />

        {/* Sidebar */}
        <S.SidebarContainer $isCollapsed={sidebarCollapsed} $isMobileOpen={mobileSidebarOpen}>
          <MeshBackground animate={false} />
          <S.LogoArea $isCollapsed={sidebarCollapsed} onClick={() => onLocaleNavigate('/dashboard')}>
            {sidebarCollapsed ? <Logo size={32} /> : <Logo layout="stacked" />}
          </S.LogoArea>

          <S.NavSection $isCollapsed={sidebarCollapsed}>
            <S.NavItem
              $active={pathWithoutLocale === '/dashboard'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => onLocaleNavigate('/dashboard')}
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
              onClick={() => onLocaleNavigate('/listings')}
              title={sidebarCollapsed ? t('translation:menu.ebayListings') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="storefront" size={18} />
                {!sidebarCollapsed && t('translation:menu.ebayListings')}
              </S.NavItemContent>
              {!sidebarCollapsed && (
                <S.BadgeWrapper variant="primary" size="sm">
                  {EBAY_LISTINGS_COUNT_PLACEHOLDER}
                </S.BadgeWrapper>
              )}
            </S.NavItem>

            <S.NavItem
              $active={pathWithoutLocale === '/listings/jobs'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => onLocaleNavigate('/listings/jobs')}
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
              onClick={() => onLocaleNavigate('/listings/products')}
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
              onClick={() => onLocaleNavigate('/orders')}
              title={sidebarCollapsed ? t('translation:menu.orders') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="inbox" size={18} />
                {!sidebarCollapsed && t('translation:menu.orders')}
              </S.NavItemContent>
              {!sidebarCollapsed && (
                <S.BadgeWrapper variant="primary" size="sm">
                  {ORDERS_COUNT_PLACEHOLDER}
                </S.BadgeWrapper>
              )}
            </S.NavItem>

            <S.NavItem
              $active={pathWithoutLocale.startsWith('/settings') || pathWithoutLocale === '/profile'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => onLocaleNavigate('/settings')}
              title={sidebarCollapsed ? t('translation:menu.settings') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="settings" size={18} />
                {!sidebarCollapsed && t('translation:menu.settings')}
              </S.NavItemContent>
            </S.NavItem>

            <S.NavItem
              $active={pathWithoutLocale === '/stores'}
              $isCollapsed={sidebarCollapsed}
              onClick={() => onLocaleNavigate('/stores')}
              title={sidebarCollapsed ? t('translation:menu.stores') : undefined}
            >
              <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                <Icon name="storefront" size={18} />
                {!sidebarCollapsed && t('translation:menu.stores')}
              </S.NavItemContent>
            </S.NavItem>
          </S.NavSection>

          <S.SidebarFooter>
            <S.LogoutButton
              $isCollapsed={sidebarCollapsed}
              onClick={onOpenLogoutConfirm}
              title={sidebarCollapsed ? t('translation:menu.logout') : undefined}
              aria-label={t('translation:menu.logout')}
            >
              <Icon name="log-out" size={18} />
              {!sidebarCollapsed && (
                <Text variant="body-sm" weight="medium" color="sidebar.text">
                  {t('translation:menu.logout')}
                </Text>
              )}
            </S.LogoutButton>
          </S.SidebarFooter>
        </S.SidebarContainer>

        {/* Main Content Area */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderInner>
              <S.HeaderLeft>
                <S.MobileMenuButton onClick={onToggleSidebar}>
                  <Icon name="menu" size={24} />
                </S.MobileMenuButton>

                <S.ToggleButton onClick={onToggleSidebar}>
                  <Icon name="menu" size={20} />
                </S.ToggleButton>
              </S.HeaderLeft>

              <S.BreadcrumbArea>
                <Breadcrumb items={breadcrumbItems} onNavigate={onNavigate} />
              </S.BreadcrumbArea>

              <S.HeaderRight>
                <S.ActionIcon onClick={onToggleTheme} title={t('translation:header.toggleTheme')}>
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
                      <S.LanguageText>{i18nLanguage.toUpperCase()}</S.LanguageText>
                      <Icon name="chevron_down" size={12} />
                    </S.LanguageSelectTrigger>
                  }
                  items={[
                    {
                      label: t('translation:languages.en'),
                      onClick: () => onChangeLanguage('en'),
                    },
                    {
                      label: t('translation:languages.tr'),
                      onClick: () => onChangeLanguage('tr'),
                    },
                  ]}
                />

                <S.VerticalDivider />

                <Dropdown
                  align="right"
                  width="12rem"
                  header={
                    <S.ProfileDropdownHeader>
                      <Text variant="body-sm" weight="semibold" color="text.primary">
                        {userName}
                      </Text>
                      <Text variant="caption" color="text.tertiary">
                        {user?.email || ''}
                      </Text>
                    </S.ProfileDropdownHeader>
                  }
                  trigger={
                    <S.HeaderProfileArea title={user?.email || ''}>
                      <S.HeaderProfileBadge>
                        {user?.firstName?.charAt(0) || 'D'}
                        {user?.lastName?.charAt(0) || 'U'}
                      </S.HeaderProfileBadge>
                      <S.HeaderProfileInfo>
                        <Text variant="body-sm" weight="semibold" color="text.primary" truncate>
                          {userName}
                        </Text>
                      </S.HeaderProfileInfo>
                    </S.HeaderProfileArea>
                  }
                  items={[
                    {
                      label: t('translation:menu.dashboard'),
                      icon: 'dashboard',
                      onClick: () => onLocaleNavigate('/dashboard'),
                    },
                    {
                      label: t('translation:menu.settings'),
                      icon: 'settings',
                      onClick: () => onLocaleNavigate('/settings'),
                    },
                    {
                      label: t('translation:menu.logout'),
                      icon: 'log-out',
                      variant: 'danger',
                      onClick: onOpenLogoutConfirm,
                    },
                  ]}
                />
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
        <S.LoadingOverlay $visible={loadingIsLoading}>
          <Icon name="loader" size={48} />
        </S.LoadingOverlay>

        <ConfirmModal
          isOpen={isLogoutConfirmOpen}
          onClose={onCloseLogoutConfirm}
          onConfirm={onLogoutConfirm}
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
