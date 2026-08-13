import { Breadcrumb, ConfirmModal, Dropdown, Icon, Logo, MeshBackground, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

import * as S from './OperatorLayout.style';
import type { OperatorLayoutProps } from './OperatorLayout.types';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { NavTooltip } from '@/layouts/shell/NavTooltip';

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
              aria-label={
                sidebarCollapsed ? t('translation:header.expandSidebar') : t('translation:header.collapseSidebar')
              }
            >
              {sidebarCollapsed ? <Logo layout="icon" height={24} /> : <Icon name="menu" size={20} />}
            </S.SidebarCollapseButton>
            <S.LogoArea
              $isCollapsed={sidebarCollapsed}
              onClick={() => onLocaleNavigate(navItems[0]?.path ?? '/')}
              title={t('translation:operator.console')}
            >
              <Logo layout="wordmark" height={30} />
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
              <NavTooltip key={item.path} label={t(item.labelKey)} collapsed={sidebarCollapsed}>
                <S.NavItem
                  $active={item.isActive}
                  $isCollapsed={sidebarCollapsed}
                  onClick={() => onLocaleNavigate(item.path)}
                  aria-label={t(item.labelKey)}
                >
                  <S.NavItemContent $isCollapsed={sidebarCollapsed}>
                    <Icon name={item.icon} size={20} />
                    {!sidebarCollapsed && t(item.labelKey)}
                  </S.NavItemContent>
                </S.NavItem>
              </NavTooltip>
            ))}
          </S.NavSection>

          <S.SidebarFooter>
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
                <Tooltip content={t('translation:header.toggleTheme')} position="bottom">
                  <S.ActionIcon
                    type="button"
                    onClick={onToggleTheme}
                    aria-label={t('translation:header.toggleTheme')}
                  >
                    <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={20} />
                  </S.ActionIcon>
                </Tooltip>

                <S.VerticalDivider />

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
                    <Tooltip content={user?.email || ''} position="bottom">
                      <S.HeaderProfileArea aria-label={user?.email || ''}>
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
                    </Tooltip>
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
