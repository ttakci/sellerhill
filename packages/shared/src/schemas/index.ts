/**
 * Form Schemas Package
 *
 * Purpose:
 * - Contains all form validation schemas
 * - Use-case/page-based organization (not domain-based)
 * - Shared across all frontend platforms (web, mobile)
 *
 * Structure:
 * - schemas/auth/       - Auth-related forms
 * - schemas/common/     - Reusable utilities
 * - schemas/store-settings/ - Store settings forms
 */

export * from './admin';
export * from './amazon';
export * from './auth';
export * from './buyer-messaging/buyer-messaging.schema';
export * from './common/form.utils';
export * from './orders';
export * from './store-settings';
