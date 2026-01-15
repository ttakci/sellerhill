import { GeneralLoading, GeneralMessage, Icon, useTheme, useUI } from '@repo/ui';
import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useGetMeQuery } from '@/features/auth/api/authApi';
import { useTranslation } from 'react-i18next';
import * as S from './AppLayout.style';

/**
 * Root layout component that wraps the entire application
 * Provides TailAdmin-inspired dashboard structure
 */
export const AppLayout: React.FC = () => {
  const { messageState, loadingState, closeMessage } = useUI();
  const { theme, themeMode } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useGetMeQuery();
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  
  const { toggleTheme } = useTheme();
  const { i18n } = useTranslation();

  const currentLang = i18n.language;

  const handleLanguageChange = (lang: string) => {
    void i18n.changeLanguage(lang);
    setLangDropdownOpen(false);
  };
  
  const navItems = [
    { label: t('menu.dashboard'), path: '/dashboard', icon: 'inbox' as const, group: 'main' },
    { label: t('menu.inventory'), path: '/inventory', icon: 'archive' as const, group: 'main' },
    { label: t('menu.orders'), path: '/orders', icon: 'calendar' as const, badge: '5', badgeVariant: 'primary' as const, group: 'main' },
    { label: t('menu.storeSettings'), path: '/settings/store', icon: 'inbox' as const, group: 'configuration' },
    { label: t('menu.reports'), path: '/reports', icon: 'bell' as const, group: 'other' },
    { label: t('menu.users'), path: '/users', icon: 'user' as const, group: 'other' },
  ];

  const userName = user ? `${user.firstName} ${user.lastName}` : 'Alex Morgan';
  const userRole = 'Admin';

  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.map((part, index) => ({
      label: part.charAt(0).toUpperCase() + part.slice(1).replace('-', ' '),
      path: '/' + parts.slice(0, index + 1).join('/'),
    }));
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <ErrorBoundary>
      <S.LayoutWrapper>
        {/* Sidebar */}
        <S.SidebarContainer $isOpen={true} $isCollapsed={sidebarCollapsed}>
          <S.LogoArea>
            <S.LogoBox>
              <Icon name="inbox" size={18} color={theme.colors.text.inverse} />
            </S.LogoBox>
            {!sidebarCollapsed && <S.LogoText>DropMaster</S.LogoText>}
          </S.LogoArea>
          
          <S.NavSection>
            {/* Main Section */}
            <S.NavGroup>
              {navItems.filter(i => i.group === 'main').map((item) => (
                <S.NavItem 
                  key={item.path} 
                  $active={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                >
                  <S.NavItemContent>
                    <Icon name={item.icon} size={22} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </S.NavItemContent>
                  {!sidebarCollapsed && item.badge && (
                    <S.Badge $variant={item.badgeVariant}>{item.badge}</S.Badge>
                  )}
                </S.NavItem>
              ))}
            </S.NavGroup>

            {/* Configuration Section */}
            <S.NavGroup>
              {!sidebarCollapsed && <S.NavLabel>{t('menu.configuration')}</S.NavLabel>}
              <S.NavItem $active={location.pathname.startsWith('/settings')}>
                <S.NavItemContent>
                  <Icon name="alert-circle" size={22} />
                  {!sidebarCollapsed && <span>{t('menu.settings')}</span>}
                </S.NavItemContent>
              </S.NavItem>
              {!sidebarCollapsed && (
                <S.SubNavDropdown>
                  <S.SubNavItem 
                    $active={location.pathname === '/settings/store'} 
                    onClick={() => navigate('/settings/store')}
                  >
                    <Icon name="inbox" size={14} />
                    <span>{t('menu.storeSettings')}</span>
                  </S.SubNavItem>
                  <S.SubNavItem>
                    <Icon name="archive" size={14} />
                    <span>Listing Settings Group</span>
                  </S.SubNavItem>
                </S.SubNavDropdown>
              )}
            </S.NavGroup>

            {/* Other Section */}
            <S.NavGroup>
               {navItems.filter(i => i.group === 'other').map((item) => (
                <S.NavItem 
                  key={item.path} 
                  $active={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                >
                  <S.NavItemContent>
                    <Icon name={item.icon} size={22} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </S.NavItemContent>
                </S.NavItem>
              ))}
            </S.NavGroup>
          </S.NavSection>

          <S.SidebarFooter>
            <S.UserProfile>
               <S.AvatarImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuAMhtx3kZSxhYC733_AHtlDOcaUThC-vR3lMouMSLwwOkzYyIr0V-DS1B9cKi0SceaKPU4doV26rBdLlFt_KpK5gGRX8Fx_5m9CN108Qu27mdNrjWrtbuOHKcJ7AuXxnKTlgX6Ndh4AMF7NACRAMW4gUgzC1hzwvlT8icArymsrdiaW0BFoUuG3ghJygf9CvoEEXEhVnH7FPr0qS4xj5afAnjBJStjngArDR1aSSoAPolYPOf31qvV1N4lLAmrAt_TUfDgqyJVRft4" />
               {!sidebarCollapsed && (
                 <S.UserInfo>
                   <S.UserName>{userName}</S.UserName>
                   <S.UserRole>{userRole}</S.UserRole>
                 </S.UserInfo>
               )}
            </S.UserProfile>
          </S.SidebarFooter>
        </S.SidebarContainer>

        {/* Main Content */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.BreadcrumbArea>
              <Icon name="inbox" size={18} color={theme.colors.text.secondary} />
              <S.Separator>/</S.Separator>
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.path}>
                  <S.BreadcrumbItem $active={i === breadcrumbs.length - 1}>
                    {crumb.label}
                  </S.BreadcrumbItem>
                  {i < breadcrumbs.length - 1 && <S.Separator>/</S.Separator>}
                </React.Fragment>
              ))}
            </S.BreadcrumbArea>
            
            <S.HeaderActions>
               <S.LanguageWrapper>
                 <S.ActionIconButton onClick={() => setLangDropdownOpen(!langDropdownOpen)}>
                   <Icon name="globe" size={18} />
                 </S.ActionIconButton>
                 <S.DropdownMenu $isOpen={langDropdownOpen}>
                   <S.DropdownItem 
                     $active={currentLang === 'en'} 
                     onClick={() => handleLanguageChange('en')}
                   >
                     🇺🇸 English
                   </S.DropdownItem>
                   <S.DropdownItem 
                     $active={currentLang === 'tr'} 
                     onClick={() => handleLanguageChange('tr')}
                   >
                     🇹🇷 Türkçe
                   </S.DropdownItem>
                 </S.DropdownMenu>
               </S.LanguageWrapper>

               <S.ActionIconButton onClick={toggleTheme}>
                 <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={18} />
               </S.ActionIconButton>

               <S.NotificationButton>
                 <Icon name="bell" size={20} />
                 <S.NotificationDot />
               </S.NotificationButton>
            </S.HeaderActions>
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


