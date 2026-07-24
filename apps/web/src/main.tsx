import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider, UIProvider } from '@repo/ui';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import { App } from './App';
import { store } from './app/store';
import { GlobalMessageModal } from './components/GlobalMessageModal';
import { AuthBootstrap } from './features/auth/AuthBootstrap';
import './i18n.config';
import './index.css';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

function RootProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  const tree = (
    <Provider store={store}>
      <ThemeProvider>
        <UIProvider>
          <AuthBootstrap>
            {children}
            <GlobalMessageModal />
          </AuthBootstrap>
        </UIProvider>
      </ThemeProvider>
    </Provider>
  );

  if (!googleClientId) {
    return tree;
  }

  return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootProviders>
      <App />
    </RootProviders>
  </React.StrictMode>
);
