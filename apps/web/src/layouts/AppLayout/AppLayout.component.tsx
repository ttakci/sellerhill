import { GeneralLoading, GeneralMessage, Icon, Text, ThemeToggle, useTheme, useUI } from '@repo/ui';
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
  const { themeMode } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useGetMeQuery();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const navItems = [
    { label: t('menu.dashboard'), path: '/dashboard', icon: 'inbox' as const },
    { label: t('menu.orders'), path: '/orders', icon: 'calendar' as const, badge: '5', badgeVariant: 'primary' as const },
    { label: t('menu.listings'), path: '/listings', icon: 'archive' as const, badge: 'NEW', badgeVariant: 'success' as const },
    { label: t('menu.settings'), path: '/settings', icon: 'alert-circle' as const },
  ];

  const handleLogout = () => {
    // Logic for logout
    navigate('/login');
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'tr' : 'en';
    i18n.changeLanguage(nextLang);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const userName = user ? `${user.firstName} ${user.lastName}` : 'Admin';

  return (
    <ErrorBoundary>
      <S.LayoutWrapper>
        {/* Sidebar */}
        <S.SidebarContainer $isOpen={sidebarOpen} $isCollapsed={sidebarCollapsed}>
          <S.LogoArea>
            <Icon name="inbox" size={32} color={themeMode === 'dark' ? '#FFFFFF' : undefined} />
            {!sidebarCollapsed && (
              <Text variant="h3" weight="bold" style={{ color: themeMode === 'dark' ? '#FFFFFF' : undefined }}>
                Zonds
              </Text>
            )}
          </S.LogoArea>
          
          <S.NavSection>
            <S.NavGroup>
              {!sidebarCollapsed && <S.NavLabel>{t('menu.main')}</S.NavLabel>}
              {navItems.map((item) => (
                <S.NavItem 
                  key={item.path} 
                  $active={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <S.NavItemContent>
                    <Icon name={item.icon} size={20} />
                    {!sidebarCollapsed && <Text variant="body" weight="medium">{item.label}</Text>}
                  </S.NavItemContent>
                  {!sidebarCollapsed && item.badge && (
                    <S.Badge $variant={item.badgeVariant}>{item.badge}</S.Badge>
                  )}
                </S.NavItem>
              ))}
            </S.NavGroup>
          </S.NavSection>
        </S.SidebarContainer>

        {/* Main Content */}
        <S.MainContent>
          <S.HeaderContainer>
            <S.HeaderActions>
               <S.SidebarToggleButton onClick={toggleSidebar}>
                 <Icon name="menu" size={24} />
               </S.SidebarToggleButton>
               
               <S.SearchWrapper>
                  <S.SearchIconWrapper>
                    <Icon name="search" size={20} />
                  </S.SearchIconWrapper>
                  <S.SearchInput placeholder="Search or type command..." />
               </S.SearchWrapper>
            </S.HeaderActions>
            
            <S.HeaderActions>
              <S.LanguageSwitcher onClick={toggleLanguage}>
                <S.FlagIcon>{i18n.language === 'tr' ? '🇹🇷' : '🇺🇸'}</S.FlagIcon>
                <Text variant="body" weight="semibold" style={{ minWidth: '60px' }}>
                  {i18n.language === 'tr' ? 'Türkçe' : 'English'}
                </Text>
              </S.LanguageSwitcher>
              
              <ThemeToggle />
              
              <div style={{ display: 'flex', gap: '12px', marginRight: '12px' }}>
                <Icon name="bell" size={22} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }} />
                <Icon name="mail" size={22} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.7)' }} />
              </div>

              <S.UserMenu onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Text variant="body" weight="semibold">{userName}</Text>
                  <Text variant="caption" color="text.secondary">Admin</Text>
                </div>
                <S.Avatar>
                  <Icon name="user" size={24} />
                </S.Avatar>
                
                {userMenuOpen && (
                  <S.Dropdown>
                    <S.DropdownItem onClick={() => navigate('/profile')}>
                      <Icon name="user" size={18} />
                      <Text variant="body">{t('menu.editProfile')}</Text>
                    </S.DropdownItem>
                    <S.DropdownItem onClick={() => navigate('/support')}>
                      <Icon name="alert-circle" size={18} />
                      <Text variant="body">{t('menu.support')}</Text>
                    </S.DropdownItem>
                    <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)' }} />
                    <S.DropdownItem onClick={handleLogout}>
                      <Icon name="trash" size={18} />
                      <Text variant="body">{t('menu.logout')}</Text>
                    </S.DropdownItem>
                  </S.Dropdown>
                )}
              </S.UserMenu>
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


