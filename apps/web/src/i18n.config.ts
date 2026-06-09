/**
 * Web App i18n Configuration
 *
 * Purpose:
 * - Web-specific i18next setup
 * - Uses shared translation resources from @repo/shared
 * - Can override or extend translations if needed
 *
 * Platform Setup:
 * - Web uses react-i18next
 * - Mobile would use a different i18next setup
 * - But both use the same translation resources
 */

import {
  enAmazon,
  enAuth,
  enDashboard,
  enEbay,
  enListings,
  enListingSettingsGroup,
  enOrders,
  enProfile,
  enStoreSettings,
  enTranslation,
  trAmazon,
  trAuth,
  trTranslation as trCommon,
  trDashboard,
  trEbay,
  trListings,
  trListingSettingsGroup,
  trOrders,
  trProfile,
  trStoreSettings,
} from '@repo/shared';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { detectBrowserLocale, getStoredLocalePreference } from './utils/locale';

// Resolve initial locale: stored preference > browser detection > default
const initialLocale = getStoredLocalePreference() || detectBrowserLocale();

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: enTranslation,
      amazon: enAmazon,
      auth: enAuth,
      dashboard: enDashboard,
      ebay: enEbay,
      storeSettings: enStoreSettings,
      listingSettingsGroup: enListingSettingsGroup,
      listings: enListings,
      profile: enProfile,
      orders: enOrders,
    },
    tr: {
      translation: trCommon,
      amazon: trAmazon,
      auth: trAuth,
      dashboard: trDashboard,
      ebay: trEbay,
      storeSettings: trStoreSettings,
      listingSettingsGroup: trListingSettingsGroup,
      listings: trListings,
      profile: trProfile,
      orders: trOrders,
    },
  },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  defaultNS: 'translation',
});

export default i18n;
