import { z } from 'zod';

/**
 * Validation schema for error DTO
 */
export const errorDTOSchema = z.object({
  errorCode: z.string(),
  messageKey: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Common validation utilities
 */
export const commonValidators = {
  /**
   * UUID validation
   */
  uuid: z.string().uuid(),

  /**
   * Email validation
   */
  email: z.string().email(),

  /**
   * URL validation
   */
  url: z.string().url(),

  /**
   * Non-empty string validation
   */
  nonEmptyString: z.string().min(1, 'This field is required'),

  /**
   * Positive integer validation
   */
  positiveInteger: z.number().int().positive(),

  /**
   * ISO date string validation
   */
  isoDateString: z.string().datetime(),
};
