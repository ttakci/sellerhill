import { Breadcrumb, ConfirmModal, Dropdown, Icon, Logo, MeshBackground, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import * as S from './AppLayout.style';
import type { AppLayoutProps } from './AppLayout.types';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { TawkToWidget } from '@/features/support-widget/TawkToWidget';
import { NavTooltip } from '@/layouts/shell/NavTooltip';

/**
 * App shell: collapsible sidebar (desktop) + overlay drawer (mobile).
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  user,
  sidebarCollapsed,
  mobileSidebarOpen,
  isLogoutConfirmOpen,
  pathWithoutLocale,
  userName,
  loadingIsLoading,
  breadcrumbItems,
  onToggleSidebar,
  onNavigate,
  onLogoutConfirm,
  onChangeLanguage,
  onCloseMobileSidebar,
  onOpenLogoutConfirm,
  onCloseLogoutConfirm,
  onLocaleNavigate,
  pendingActionCount,
  hasCriticalActions,
  i18nLanguage,
}) => {
  const { t } = useTranslation(['translation', 'actionCenter', 'listings', 'orders']);

  return (
    <ErrorBoundary>
      <S.LayoutWrapper>
        {/* Mobile Sidebar Overlay */}
        <S.SidebarOverlay $isOpen={mobileSidebarOpen} onClick={onCloseMobileSidebar} />

        {/* Sidebar */}
        <S.SidebarContainer $isCollapsed={sidebarCollapsed} $isMobileOpen={mobileSidebarOpen}>
          <MeshBackground animate={false} />
          {/* Sellerboard strip: [menu] [logo] one row — divider = border-bottom */}
          <S.SidebarBrandRow $isCollapsed={sidebarCollapsed}>
            <S.SidebarCollapseButton
              type="button"
              $isCollapsed={sidebarCollapsed}
              onClick={onToggleSidebar}
              aria-label={
                sidebarCollapsed ? t('translation:header.expandSidebar') : t('translation:header.collapseSidebar')
              }
            >
              {sidebarCollapsed ? <Logo layout="icon" height={24} /> : <Icon name="menu" size={20} />}
            </S.SidebarCollapseButton>
            <S.LogoArea
              $isCollapsed={sidebarCollapsed}
              onClick={() => onLocaleNavigate('/dashboard')}
              title={t('translation:menu.dashboard')}
            >
              <Logo layout="wordmark" height={30} />
            </S.LogoArea>
          </S.SidebarBrandRow>

          <S.NavSection $isCollapsed={sidebarCollapsed}>
            <NavTooltip label={t('translation:menu.dashboard')} collapsed={sidebarCollapsed}>
              <S.NavItem
                $active={pathWithoutLocale === '/dashboard'}
                $isCollapsed={sidebarCollapsed}
                onClick={() => onLocaleNavigate('/dashboard')}
                aria-label={t('translation:menu.dashboard')}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="dashboard" size={20} />
                  {!sidebarCollapsed && <S.NavItemLabel>{t('translation:menu.dashboard')}</S.NavItemLabel>}
                </S.NavItemContent>
              </S.NavItem>
            </NavTooltip>

            {/*
              Pending Actions sits directly under Dashboard on purpose: the
              dashboard says what happened, this says what is waiting. The badge
              is what makes a blocked purchase or a revoked store token
              discoverable without already suspecting it — every other surface
              requires the seller to open the right list with the right filter
              in mind. It renders nothing at all when the count is zero.
            */}
            <NavTooltip
              label={
                pendingActionCount > 0
                  ? `${t('actionCenter:actionCenter.menu')} (${pendingActionCount})`
                  : t('actionCenter:actionCenter.menu')
              }
              collapsed={sidebarCollapsed}
            >
              <S.NavItem
                $active={pathWithoutLocale === '/actions'}
                $isCollapsed={sidebarCollapsed}
                onClick={() => onLocaleNavigate('/actions')}
                aria-label={t('actionCenter:actionCenter.menu')}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="bell-ring" size={20} />
                  {!sidebarCollapsed && <S.NavItemLabel>{t('actionCenter:actionCenter.menu')}</S.NavItemLabel>}
                </S.NavItemContent>
                {pendingActionCount > 0 &&
                  (sidebarCollapsed ? (
                    <S.NavBadgeDot $urgent={hasCriticalActions} />
                  ) : (
                    <S.NavBadge $urgent={hasCriticalActions}>{pendingActionCount}</S.NavBadge>
                  ))}
              </S.NavItem>
            </NavTooltip>

            <NavTooltip label={t('translation:menu.orders')} collapsed={sidebarCollapsed}>
              <S.NavItem
                $isCollapsed={sidebarCollapsed}
                $active={pathWithoutLocale === '/orders' || pathWithoutLocale.startsWith('/orders/')}
                onClick={() => onLocaleNavigate('/orders')}
                aria-label={t('translation:menu.orders')}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="shopping-bag" size={20} />
                  {!sidebarCollapsed && <S.NavItemLabel>{t('translation:menu.orders')}</S.NavItemLabel>}
                </S.NavItemContent>
              </S.NavItem>
            </NavTooltip>

            <NavTooltip label={t('translation:menu.ebayListings')} collapsed={sidebarCollapsed}>
              <S.NavItem
                $active={
                  pathWithoutLocale === '/listings' ||
                  pathWithoutLocale === '/listings/all' ||
                  (pathWithoutLocale.startsWith('/listings/') &&
                    !pathWithoutLocale.startsWith('/listings/jobs') &&
                    pathWithoutLocale !== '/listings/products' &&
                    pathWithoutLocale !== '/listings/add')
                }
                $isCollapsed={sidebarCollapsed}
                onClick={() => onLocaleNavigate('/listings')}
                aria-label={t('translation:menu.ebayListings')}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="inventory" size={20} />
                  {!sidebarCollapsed && <S.NavItemLabel>{t('translation:menu.ebayListings')}</S.NavItemLabel>}
                </S.NavItemContent>
              </S.NavItem>
            </NavTooltip>

            <NavTooltip label={t('translation:menu.listingJobs')} collapsed={sidebarCollapsed}>
              <S.NavItem
                $active={pathWithoutLocale === '/listings/jobs'}
                $isCollapsed={sidebarCollapsed}
                onClick={() => onLocaleNavigate('/listings/jobs')}
                aria-label={t('translation:menu.listingJobs')}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="clipboard-list" size={20} />
                  {!sidebarCollapsed && <S.NavItemLabel>{t('translation:menu.listingJobs')}</S.NavItemLabel>}
                </S.NavItemContent>
              </S.NavItem>
            </NavTooltip>

            <NavTooltip label={t('translation:menu.billing')} collapsed={sidebarCollapsed}>
              <S.NavItem
                $active={pathWithoutLocale === '/billing'}
                $isCollapsed={sidebarCollapsed}
                onClick={() => onLocaleNavigate('/billing')}
                aria-label={t('translation:menu.billing')}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="wallet-cards" size={20} />
                  {!sidebarCollapsed && <S.NavItemLabel>{t('translation:menu.billing')}</S.NavItemLabel>}
                </S.NavItemContent>
              </S.NavItem>
            </NavTooltip>

            {/*
              No admin or support entry here on purpose. Staff work lives in
              the operator console (`OperatorLayout`), which a seller account
              cannot open — the two products no longer share a menu.
            */}
            <NavTooltip label={t('translation:menu.settings')} collapsed={sidebarCollapsed}>
              <S.NavItem
                $active={
                  pathWithoutLocale.startsWith('/settings') ||
                  pathWithoutLocale === '/profile' ||
                  pathWithoutLocale === '/stores'
                }
                $isCollapsed={sidebarCollapsed}
                onClick={() => onLocaleNavigate('/settings')}
                aria-label={t('translation:menu.settings')}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name="settings" size={20} />
                  {!sidebarCollapsed && <S.NavItemLabel>{t('translation:menu.settings')}</S.NavItemLabel>}
                </S.NavItemContent>
              </S.NavItem>
            </NavTooltip>
          </S.NavSection>

          <S.SidebarFooter>
            <TawkToWidget sidebarCollapsed={sidebarCollapsed} onLaunch={onCloseMobileSidebar} />
            <NavTooltip label={t('translation:menu.logout')} collapsed={sidebarCollapsed}>
              <S.LogoutButton
                $isCollapsed={sidebarCollapsed}
                onClick={onOpenLogoutConfirm}
                aria-label={t('translation:menu.logout')}
              >
                <Icon name="log-out" size={20} />
                {!sidebarCollapsed && (
                  <Text variant="body" weight="medium" color="sidebar.text">
                    {t('translation:menu.logout')}
                  </Text>
                )}
              </S.LogoutButton>
            </NavTooltip>
          </S.SidebarFooter>
        </S.SidebarContainer>

        {/* Main Content Area */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderInner>
              <S.HeaderLeft>
                {/* Mobile only — opens the off-canvas sidebar */}
                <S.MobileMenuButton
                  type="button"
                  onClick={onToggleSidebar}
                  aria-label={t('translation:header.openMenu')}
                >
                  <Icon name="menu" size={24} />
                </S.MobileMenuButton>
              </S.HeaderLeft>

              <S.BreadcrumbArea>
                <Breadcrumb items={breadcrumbItems} onNavigate={onNavigate} />
              </S.BreadcrumbArea>

              <S.HeaderRight>
                <Dropdown
                  align="right"
                  width="8rem"
                  trigger={
                    <Tooltip content={t('translation:header.selectLanguage')} position="bottom">
                      <S.LanguageSelectTrigger aria-label={t('translation:header.selectLanguage')}>
                        <S.LanguageText>{t(`translation:languages.${i18nLanguage}`)}</S.LanguageText>
                        <Icon name="chevron-down" size={12} />
                      </S.LanguageSelectTrigger>
                    </Tooltip>
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
                    <S.HeaderProfileArea aria-label={user?.email || ''}>
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
          type="warning"
          typeTitles={{
            info: t('translation:dialog.title.info'),
            success: t('translation:dialog.title.success'),
            warning: t('translation:dialog.title.warning'),
            error: t('translation:dialog.title.error'),
          }}
          description={t('translation:menu.logoutConfirmDescription')}
          confirmLabel={t('translation:menu.logoutConfirmButton')}
          cancelLabel={t('translation:common.cancel')}
        />
      </S.LayoutWrapper>
    </ErrorBoundary>
  );
};

AppLayout.displayName = 'AppLayout';
