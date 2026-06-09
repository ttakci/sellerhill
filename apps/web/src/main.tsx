import { ThemeProvider, UIProvider } from '@repo/ui';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import { App } from './App';
import { store } from './app/store';
import { GlobalMessageModal } from './components/GlobalMessageModal';
import './i18n.config';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <UIProvider>
          <App />
          <GlobalMessageModal />
        </UIProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
