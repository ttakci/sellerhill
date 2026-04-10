/**
 * i18n Translation Types
 * 
 * Purpose:
 * - Provides type-safe access to translation keys
 * - Auto-generated from translation JSON files
 * - Prevents typos in translation keys
 * 
 * Usage:
 * ```typescript
 * import type { TranslationKeys } from '@repo/shared';
 * 
 * const key: TranslationKeys = 'example.title'; // Type-safe
 * t(key);
 * ```
 */

import type auth from './resources/en/auth.json';
import type dashboard from './resources/en/dashboard.json';
import type ebay from './resources/en/ebay.json';
import type en from './resources/en/translation.json';
import type listings from './resources/en/listings.json';
import type listingSettingsGroup from './resources/en/listingSettingsGroup.json';
import type orders from './resources/en/orders.json';
import type profile from './resources/en/profile.json';
import type storeSettings from './resources/en/storeSettings.json';

/**
 * Translation resource structure
 * Combined from all resource files
 */
export type TranslationResource = typeof en &
  typeof auth &
  typeof ebay &
  typeof dashboard &
  typeof listings &
  typeof listingSettingsGroup &
  typeof orders &
  typeof profile &
  typeof storeSettings;


/**
 * Utility type to get all nested keys from translation object
 */
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T]-?: K extends string
        ? T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}` | K
          : K
        : never;
    }[keyof T]
  : never;

/**
 * All available translation keys (type-safe)
 * Examples: 'example.title', 'example.searchLabel', 'errors.example.notFound'
 */
export type TranslationKeys = NestedKeyOf<TranslationResource>;

/**
 * Supported languages
 */
export type SupportedLanguage = 'en' | 'tr';

/**
 * Language configuration
 */
export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
}

/**
 * Available languages with metadata
 */
export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
  },
  tr: {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
  },
};
