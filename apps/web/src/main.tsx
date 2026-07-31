// MUST be the first import in the app entry point. class-transformer `@Type`
// decorators (billing plan input DTOs in @repo/shared) call Reflect.getMetadata
// while the module is being evaluated, so the polyfill has to be installed
// before ANY module that pulls in @repo/shared — directly or transitively.
// ES module imports evaluate in source order: a single @repo/shared import
// placed above this line crashes the app at boot with
// "Reflect.getMetadata is not a function".
import 'reflect-metadata';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { buildAmazonProductUrl, buildEbayItemUrl, resolveEbayEnvironment } from '@repo/shared';
import { MarketplaceProvider, ThemeProvider, UIProvider } from '@repo/ui';
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
// Must match the API's EBAY_ENVIRONMENT: sandbox listing ids are dead links on
// ebay.com, so every buyer-facing eBay link is built against this value.
const ebayEnvironment = resolveEbayEnvironment(import.meta.env.VITE_EBAY_ENVIRONMENT);
const ebayItemUrl = (itemId: string): string => buildEbayItemUrl(itemId, ebayEnvironment);

function RootProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  const tree = (
    <Provider store={store}>
      <ThemeProvider>
        <MarketplaceProvider buildEbayItemUrl={ebayItemUrl} buildAmazonProductUrl={buildAmazonProductUrl}>
          <UIProvider>
            <AuthBootstrap>
              {children}
              <GlobalMessageModal />
            </AuthBootstrap>
          </UIProvider>
        </MarketplaceProvider>
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
