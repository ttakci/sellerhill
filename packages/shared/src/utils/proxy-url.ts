/**
 * The `scraper.proxies` value grammar, shared by the admin panel (draft check),
 * the API (save-time validation + dropping bad entries before a request) and,
 * by the same regex, the scraper service (`services/amazon-scraper/sellerhill/app.py`).
 *
 * One malformed entry used to reach the service and 400 the whole call, so
 * every fetch failed while the admin panel showed a non-empty proxy list. The
 * three sides agree on one rule now, and every message about a bad entry names
 * its POSITION only — a proxy URL carries credentials.
 */

/** `scheme://[user:pass@]host:port`, scheme http/https/socks5/socks5h, port 1–5 digits. */
const PROXY_URL_PATTERN = /^(http|https|socks5|socks5h):\/\/[^\s]+:(\d{1,5})$/;

const MAX_PORT = 65_535;

export function isValidProxyUrl(value: string): boolean {
  const match = PROXY_URL_PATTERN.exec(value);
  return match !== null && Number(match[2]) <= MAX_PORT;
}

/** Entries of a newline/comma-separated list, in order, trimmed, blanks dropped. */
export function splitProxyList(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export interface ProxyListPartition {
  /** Valid entries, de-duplicated, in first-seen order. */
  valid: string[];
  /** 1-based positions (among non-blank entries) of the invalid ones. */
  invalidEntries: number[];
}

export function partitionProxyList(raw: string | null | undefined): ProxyListPartition {
  const valid: string[] = [];
  const invalidEntries: number[] = [];
  splitProxyList(raw).forEach((entry, index) => {
    if (!isValidProxyUrl(entry)) {
      invalidEntries.push(index + 1);
    } else if (!valid.includes(entry)) {
      valid.push(entry);
    }
  });
  return { valid, invalidEntries };
}
