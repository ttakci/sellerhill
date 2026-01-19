import enAuth from './resources/en/auth.json';
import enDashboard from './resources/en/dashboard.json';
import enEbay from './resources/en/ebay.json';
import enListings from './resources/en/listings.json';
import enListingSettingsGroup from './resources/en/listingSettingsGroup.json';
import enProfile from './resources/en/profile.json';
import enStoreSettings from './resources/en/storeSettings.json';
import enTranslation from './resources/en/translation.json';

import trAuth from './resources/tr/auth.json';
import trDashboard from './resources/tr/dashboard.json';
import trEbay from './resources/tr/ebay.json';
import trListings from './resources/tr/listings.json';
import trListingSettingsGroup from './resources/tr/listingSettingsGroup.json';
import trProfile from './resources/tr/profile.json';
import trStoreSettings from './resources/tr/storeSettings.json';
import trTranslation from './resources/tr/translation.json';

export {
  enAuth,
  enDashboard,
  enEbay, enListings, enListingSettingsGroup, enProfile,
  enStoreSettings,
  enTranslation,
  trAuth,
  trDashboard,
  trEbay, trListings, trListingSettingsGroup, trProfile,
  trStoreSettings,
  trTranslation
};

// Merged translations
// We priorityze the domain-specific files over the main translation file
export const enTranslations = {
  ...enTranslation,
  ...enAuth,
  ...enEbay,
  ...enDashboard,
  ...enListings,
  ...enStoreSettings,
  ...enListingSettingsGroup,
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
  },
  listingSettingsGroup: {
    ...(enTranslation as any).listingSettingsGroup,
    ...(enListingSettingsGroup as any).listingSettingsGroup,
  },
  listings: {
    ...(enTranslation as any).listings,
    ...(enListings as any).listings,
  },
  profile: {
    ...(enTranslation as any).profile,
    ...(enProfile as any).profile,
  }
};

export const trTranslations = {
  ...trTranslation,
  ...trAuth,
  ...trEbay,
  ...trDashboard,
  ...trStoreSettings,
  ...trListingSettingsGroup,
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
  },
  listingSettingsGroup: {
    ...(trTranslation as any).listingSettingsGroup,
    ...(trListingSettingsGroup as any).listingSettingsGroup,
  },
  listings: {
    ...(trTranslation as any).listings,
    ...(trListings as any).listings,
  },
  profile: {
    ...(trTranslation as any).profile,
    ...(trProfile as any).profile,
  }
};

export * from './types';

