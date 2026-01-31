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
  enAuth,
  enDashboard,
  enEbay,
  enListings,
  enListingSettingsGroup,
  enOrders,
  enProfile,
  enStoreSettings,
  enTranslation,
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

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: enTranslation,
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
  lng: 'tr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  defaultNS: 'translation',
});

export default i18n;
