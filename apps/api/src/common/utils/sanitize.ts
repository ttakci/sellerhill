/**
 * HTML Sanitization Utilities
 * Prevents XSS when inserting product data into eBay listing descriptions
 */

/**
 * Dangerous patterns to strip from HTML content
 */
const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<script\b[^>]*>/gi,
  /<\/script>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi, // onerror="", onclick="", etc.
  /on\w+\s*=\s*[^\s>]+/gi,         // onerror=alert(1)
  /javascript\s*:/gi,
  /data\s*:\s*text\/html/gi,
  /vbscript\s*:/gi,
  /expression\s*\(/gi,
];

/**
 * Strip all dangerous HTML patterns from a string.
 * Used before inserting product data (title, description, brand, features)
 * into eBay listing descriptions.
 */
export function sanitizeHtml(input: string): string {
  let sanitized = input;

  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized.trim();
}

/**
 * Sanitize a string for safe inclusion in eBay listing content.
 * Escapes HTML special characters while preserving basic formatting.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize an array of strings (e.g., product features)
 */
export function sanitizeStringArray(items: string[]): string[] {
  return items.map((item) => sanitizeHtml(item));
}
