/**
 * Request ID Utility
 *
 * Purpose:
 * - Generate unique request IDs for API calls
 * - Enable end-to-end request tracking
 * - Facilitate debugging and support
 *
 * Format: req_<uuid>
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a unique request ID
 * @returns Request ID in format: req_<uuid>
 */
export function generateRequestId(): string {
  return `req_${uuidv4()}`;
}
