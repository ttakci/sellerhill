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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <UIProvider>
          <AuthBootstrap>
            <App />
            <GlobalMessageModal />
          </AuthBootstrap>
        </UIProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
