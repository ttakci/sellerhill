/**
 * Common Form Validation Utilities
 * 
 * Purpose:
 * - Provides reusable Zod validation helpers with i18n support
 * - Ensures consistency across all forms
 * - Reduces code duplication
 * 
 * Usage:
 * ```typescript
 * import { createFormValidators } from '@repo/shared';
 * 
 * const validators = createFormValidators(t);
 * const mySchema = z.object({
 *   email: validators.email,
 *   name: validators.requiredString(3, 50),
 * });
 * ```
 */

import { z } from 'zod';

/**
 * Translation function type
 */
type TFunction = (key: string, params?: Record<string, string | number>) => string;

/**
 * Reusable form validation helpers with i18n support
 * These can be used across all form schemas for common field types
 */
export const createFormValidators = (t: TFunction) => ({
  /**
   * Required string with min/max length
   */
  requiredString: (min = 1, max = 255, customMessage?: string) =>
    z
      .string()
      .min(min, customMessage || t('validation.minLength', { min: String(min) }))
      .max(max, customMessage || t('validation.maxLength', { max: String(max) })),

  /**
   * Optional string with min/max length
   */
  optionalString: (min = 1, max = 255) =>
    z
      .string()
      .min(min, t('validation.minLength', { min: String(min) }))
      .max(max, t('validation.maxLength', { max: String(max) }))
      .optional(),

  /**
   * Email validation with user-friendly error message
   */
  email: z.string().email(t('validation.invalidEmail')),

  /**
   * URL validation with user-friendly error message
   */
  url: z.string().url(t('validation.invalidUrl')),

  /**
   * UUID validation
   */
  uuid: z.string().uuid(t('validation.invalidUuid')),

  /**
   * Positive integer validation
   */
  positiveInteger: (message?: string) =>
    z.number().int().positive(message || t('validation.mustBePositive')),

  /**
   * Phone number validation (simple pattern)
   */
  phoneNumber: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, t('validation.invalidPhone')),

  /**
   * Password validation
   */
  password: (minLength = 8) =>
    z
      .string()
      .min(minLength, t('validation.minLength', { min: String(minLength) }))
      .regex(/[A-Z]/, t('validation.passwordRequirements'))
      .regex(/[a-z]/, t('validation.passwordRequirements'))
      .regex(/[0-9]/, t('validation.passwordRequirements')),

  /**
   * Date string validation (ISO format)
   */
  dateString: z.string().datetime(t('validation.invalidDate')),

  /**
   * Boolean with custom error
   */
  requiredBoolean: (message?: string) =>
    z.boolean().refine((val) => val === true, { message: message || t('validation.required') }),

  /**
   * Alphanumeric string (letters, numbers, spaces, hyphens, underscores)
   */
  alphanumeric: (min = 1, max = 255) =>
    z
      .string()
      .min(min, t('validation.minLength', { min: String(min) }))
      .max(max, t('validation.maxLength', { max: String(max) }))
      .regex(/^[a-zA-Z0-9\s-_]+$/, t('validation.onlyAlphanumeric')),

  /**
   * Search query string (optional, used in filters)
   */
  searchQuery: z.string().optional(),

  /**
   * Pagination - page number
   */
  pageNumber: z.coerce.number().int().positive().default(1).optional(),

  /**
   * Pagination - limit/items per page
   */
  limitPerPage: (max = 100) => z.coerce.number().int().positive().max(max).default(10).optional(),
});

/**
 * Domain-Specific Validators Factory
 * 
 * These are reusable validators for specific domain fields
 * Use these to ensure consistency across all forms for the same domain entity
 */
export const createDomainValidators = (t: TFunction) => {
  const formValidators = createFormValidators(t);
  
  return {
    /**
     * Example name validation
     * Used consistently across all example-related forms
     */
    exampleName: formValidators.alphanumeric(3, 100),

    /**
     * Optional example name (for update forms)
     */
    exampleNameOptional: formValidators.alphanumeric(3, 100).optional(),
  };
};
