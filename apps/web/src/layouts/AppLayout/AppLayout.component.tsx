import { GeneralLoading, GeneralMessage, ThemeToggle, useUI } from '@repo/ui';
import React from 'react';
import styled from 'styled-components';

import { ErrorBoundary } from '@/components/ErrorBoundary';

interface AppLayoutProps {
  children: React.ReactNode;
}

const Header = styled.header`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.primary};
`;

/**
 * Root layout component that wraps the entire application
 * Provides global UI components like loading overlay and message dialogs
 * Platform: Web (uses GeneralLoading, GeneralMessage)
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { messageState, loadingState, closeMessage } = useUI();

  return (
    <ErrorBoundary>
      <Header>
        <ThemeToggle />
      </Header>

      {children}

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
