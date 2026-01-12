/**
 * API Validation Schemas for Example Domain
 *
 * Purpose:
 * - Validates incoming API requests on the backend
 * - Ensures data integrity at the API boundary
 * - Provides runtime type checking for Request/Response types
 *
 * Usage:
 * - Used by backend API controllers/services
 * - Validates request body, query params, and responses
 *
 * Note:
 * - These are for API validation, not form validation
 * - For form validation, see schemas package
 * - Error messages are generic (not user-friendly)
 */

import { z } from 'zod';

import { EXAMPLE_STATUS } from './example.constants';

/**
 * API validation schema for Get Examples request
 * Used by backend to validate query params
 */
export const getExamplesRequestSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

/**
 * API validation schema for Create Example request
 * Used by backend to validate incoming requests
 */
export const createExampleRequestSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * API validation schema for Update Example request
 * Used by backend to validate incoming requests
 */
export const updateExampleRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum([EXAMPLE_STATUS.ACTIVE, EXAMPLE_STATUS.ARCHIVED]).optional(),
});

/**
 * API validation schema for Example Item response
 * Used by backend to validate outgoing responses
 */
export const exampleItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum([EXAMPLE_STATUS.ACTIVE, EXAMPLE_STATUS.ARCHIVED]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * API validation schema for Get Examples response
 */
export const getExamplesResponseSchema = z.object({
  data: z.array(exampleItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
