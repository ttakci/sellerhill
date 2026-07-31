import { Breadcrumb, ConfirmModal, Dropdown, Icon, Logo, MeshBackground, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import * as S from './OperatorLayout.style';
import type { OperatorLayoutProps } from './OperatorLayout.types';

import { ErrorBoundary } from '@/components/ErrorBoundary';

/**
 * Operator shell: the staff-side counterpart of `AppLayout`.
 *
 * It intentionally carries none of the seller navigation, no store switcher
 * and no assistant widget — an operator account has no listings, orders or
 * eBay stores to reach, and the API refuses those surfaces for it anyway.
 */
export const OperatorLayout: React.FC<OperatorLayoutProps> = ({
  user,
  userName,
  navItems,
  breadcrumbItems,
  sidebarCollapsed,
  mobileSidebarOpen,
  isLogoutConfirmOpen,
  loadingIsLoading,
  themeMode,
  i18nLanguage,
  onToggleSidebar,
  onNavigate,
  onLocaleNavigate,
  onChangeLanguage,
  onToggleTheme,
  onCloseMobileSidebar,
  onOpenLogoutConfirm,
  onCloseLogoutConfirm,
  onLogoutConfirm,
}) => {
  const { t } = useTranslation(['translation', 'admin']);

  return (
    <ErrorBoundary>
      <S.LayoutWrapper>
        <S.SidebarOverlay $isOpen={mobileSidebarOpen} onClick={onCloseMobileSidebar} />

        <S.SidebarContainer $isCollapsed={sidebarCollapsed} $isMobileOpen={mobileSidebarOpen}>
          <MeshBackground animate={false} />
          <S.SidebarBrandRow $isCollapsed={sidebarCollapsed}>
            <S.SidebarCollapseButton
              type="button"
              $isCollapsed={sidebarCollapsed}
              onClick={onToggleSidebar}
              title={sidebarCollapsed ? t('translation:header.expandSidebar') : t('translation:header.collapseSidebar')}
              aria-label={
                sidebarCollapsed ? t('translation:header.expandSidebar') : t('translation:header.collapseSidebar')
              }
            >
              <Icon name="menu" size={20} />
            </S.SidebarCollapseButton>
            <S.LogoArea
              $isCollapsed={sidebarCollapsed}
              onClick={() => onLocaleNavigate(navItems[0]?.path ?? '/')}
              title={t('translation:operator.console')}
            >
              <Logo layout="nav" height={80} />
            </S.LogoArea>
          </S.SidebarBrandRow>

          <S.NavSection $isCollapsed={sidebarCollapsed}>
            {!sidebarCollapsed && (
              <S.NavLabelWrapper $isCollapsed={sidebarCollapsed}>
                <Text variant="overline" color="sidebar.textMuted">
                  {t('translation:operator.console')}
                </Text>
              </S.NavLabelWrapper>
            )}

            {navItems.map((item) => (
              <S.NavItem
                key={item.path}
                $active={item.isActive}
                $isCollapsed={sidebarCollapsed}
                onClick={() => onLocaleNavigate(item.path)}
                title={sidebarCollapsed ? t(item.labelKey) : undefined}
              >
                <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                  <Icon name={item.icon} size={20} />
                  {!sidebarCollapsed && t(item.labelKey)}
                </S.NavItemContent>
              </S.NavItem>
            ))}
          </S.NavSection>

          <S.SidebarFooter>
            <S.LogoutButton
              $isCollapsed={sidebarCollapsed}
              onClick={onOpenLogoutConfirm}
              title={sidebarCollapsed ? t('translation:menu.logout') : undefined}
              aria-label={t('translation:menu.logout')}
            >
              <Icon name="log-out" size={20} />
              {!sidebarCollapsed && (
                <Text variant="body" weight="medium" color="sidebar.text">
                  {t('translation:menu.logout')}
                </Text>
              )}
            </S.LogoutButton>
          </S.SidebarFooter>
        </S.SidebarContainer>

        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderInner>
              <S.HeaderLeft>
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
                <S.ActionIcon
                  type="button"
                  onClick={onToggleTheme}
                  title={t('translation:header.toggleTheme')}
                  aria-label={t('translation:header.toggleTheme')}
                >
                  <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={20} />
                </S.ActionIcon>

                <S.VerticalDivider />

                <Dropdown
                  align="right"
                  width="6.25rem"
                  trigger={
                    <S.LanguageSelectTrigger
                      title={t('translation:header.selectLanguage')}
                      aria-label={t('translation:header.selectLanguage')}
                    >
                      <S.LanguageText>{i18nLanguage.toUpperCase()}</S.LanguageText>
                      <Icon name="chevron_down" size={12} />
                    </S.LanguageSelectTrigger>
                  }
                  items={[
                    { label: t('translation:languages.en'), onClick: () => onChangeLanguage('en') },
                    { label: t('translation:languages.tr'), onClick: () => onChangeLanguage('tr') },
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
                        {user?.firstName?.charAt(0) || 'O'}
                        {user?.lastName?.charAt(0) || 'P'}
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
        </S.MainContent>

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

OperatorLayout.displayName = 'OperatorLayout';
