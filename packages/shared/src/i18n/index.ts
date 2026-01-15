import enAuth from './resources/en/auth.json';
import enDashboard from './resources/en/dashboard.json';
import enEbay from './resources/en/ebay.json';
import enStoreSettings from './resources/en/storeSettings.json';
import enTranslation from './resources/en/translation.json';

import trAuth from './resources/tr/auth.json';
import trDashboard from './resources/tr/dashboard.json';
import trEbay from './resources/tr/ebay.json';
import trStoreSettings from './resources/tr/storeSettings.json';
import trTranslation from './resources/tr/translation.json';

// Merged translations
// We priorityze the domain-specific files over the main translation file
export const enTranslations = {
  ...enTranslation,
  ...enAuth,
  ...enEbay,
  ...enDashboard,
  ...enStoreSettings,
  // Ensure nested objects are merged if they exist in both
  auth: {
    ...(enTranslation as any).auth,
    ...(enAuth as any).auth,
  },
  ebay: {
    ...(enTranslation as any).ebay,
    ...(enEbay as any).ebay,
  },
  dashboard: {
    ...(enTranslation as any).dashboard,
    ...(enDashboard as any).dashboard,
  },
  storeSettings: {
    ...(enTranslation as any).storeSettings,
    ...(enStoreSettings as any).storeSettings,
  }
};

export const trTranslations = {
  ...trTranslation,
  ...trAuth,
  ...trEbay,
  ...trDashboard,
  ...trStoreSettings,
  auth: {
    ...(trTranslation as any).auth,
    ...(trAuth as any).auth,
  },
  ebay: {
    ...(trTranslation as any).ebay,
    ...(trEbay as any).ebay,
  },
  dashboard: {
    ...(trTranslation as any).dashboard,
    ...(trDashboard as any).dashboard,
  },
  storeSettings: {
    ...(trTranslation as any).storeSettings,
    ...(trStoreSettings as any).storeSettings,
  }
};

export * from './types';

