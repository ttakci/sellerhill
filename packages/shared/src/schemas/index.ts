/**
 * Form Schemas Package
 * 
 * Purpose:
 * - Contains all form validation schemas
 * - Use-case/page-based organization (not domain-based)
 * - Shared across all frontend platforms (web, mobile)
 * 
 * Structure:
 * - schemas/example/    - Example-related forms
 * - schemas/user/       - User-related forms
 * - schemas/complex/    - Multi-domain forms
 * - schemas/common/     - Reusable utilities
 */

export * from './example';
export * from './common/form.utils';
