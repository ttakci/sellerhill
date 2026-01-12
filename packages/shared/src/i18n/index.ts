/**
 * i18n Resources Package
 * 
 * Purpose:
 * - Centralized translation resources for all platforms
 * - Type-safe translation keys
 * - Shared across web, mobile, and other frontends
 * 
 * Usage:
 * ```typescript
 * import { enTranslations, trTranslations, SUPPORTED_LANGUAGES } from '@repo/shared';
 * 
 * i18n.init({
 *   resources: {
 *     en: { translation: enTranslations },
 *     tr: { translation: trTranslations },
 *   },
 * });
 * ```
 */

export { default as enTranslations } from './resources/en/translation.json';
export { default as trTranslations } from './resources/tr/translation.json';

export * from './types';
