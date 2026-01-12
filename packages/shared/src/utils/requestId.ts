/**
 * Request ID Utility
 *
 * Platform-agnostic request ID generation for tracking API calls
 * Works on Web, React Native, and Node.js
 *
 * Purpose:
 * - Generate unique request IDs for end-to-end tracking
 * - Enable correlation between frontend and backend logs
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

/**
 * Extract request ID from response headers
 * @param headers - Response headers
 * @returns Request ID or null if not found
 */
export function getRequestIdFromHeaders(headers: Headers | Record<string, string>): string | null {
  if (headers instanceof Headers) {
    return headers.get('X-Request-ID');
  }
  return headers['X-Request-ID'] ?? headers['x-request-id'] ?? null;
}

/**
 * Validate request ID format
 * @param requestId - Request ID to validate
 * @returns True if valid format
 */
export function isValidRequestId(requestId: string): boolean {
  return /^req_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
}
