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
 * Tags eBay's active-content policy forbids in a listing description.
 * eBay silently strips (or rejects) these; leaving them in produces the broken,
 * half-rendered description box buyers see instead of the template.
 */
const ACTIVE_CONTENT_PATTERNS = [
  /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,
  /<iframe\b[^>]*\/?>/gi,
  /<form\b[^>]*>[\s\S]*?<\/form>/gi,
  /<form\b[^>]*\/?>/gi,
  /<object\b[^>]*>[\s\S]*?<\/object>/gi,
  /<embed\b[^>]*\/?>/gi,
  /<applet\b[^>]*>[\s\S]*?<\/applet>/gi,
  /<meta\b[^>]*\/?>/gi,
  /<link\b[^>]*\/?>/gi,
  /<base\b[^>]*\/?>/gi,
];

/**
 * Sanitize a full listing description before it is sent to eBay.
 * Same XSS strip as `sanitizeHtml`, plus eBay's active-content rules. CSS is
 * intentionally preserved — `<style>` blocks are allowed and every seeded
 * template relies on them for layout.
 */
export function sanitizeListingHtml(input: string): string {
  let sanitized = sanitizeHtml(input);

  for (const pattern of ACTIVE_CONTENT_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized.trim();
}

/**
 * Truncate HTML without slicing through a tag.
 *
 * eBay accepts 500,000 characters; the old client cut at 4,000, which severed
 * styled templates mid-element and collapsed the rendered description.
 */
export function truncateHtml(input: string, maxLength: number): string {
  if (input.length <= maxLength) {
    return input;
  }
  const slice = input.slice(0, maxLength);
  const lastOpen = slice.lastIndexOf('<');
  const lastClose = slice.lastIndexOf('>');
  // A '<' after the last '>' means we cut inside a tag — drop the partial tag.
  return (lastOpen > lastClose ? slice.slice(0, lastOpen) : slice).trim();
}

/**
 * Buyer-visible text of an HTML description.
 *
 * Blacklist checks must run against this, never the raw markup: product image
 * URLs are Amazon-hosted (`images-na.ssl-images-amazon.com`), so a seller's
 * perfectly reasonable "amazon" keyword matched the `src` attribute of the
 * template's own `<img>` and blocked every single listing — while no buyer ever
 * saw the word. CSS class names and inline styles are excluded for the same
 * reason.
 */
export function extractVisibleText(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Drop every tag WITH its attributes (href/src/class/style live here).
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
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
