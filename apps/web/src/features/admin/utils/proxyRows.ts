import { splitProxyList } from '@repo/shared';

import { ProxyScheme, type ProxyRowState } from '../components/ScraperProxiesEditor/ScraperProxiesEditor.types';

let localIdCounter = 0;

/** A fresh, empty row for the editor's "+ add proxy" action. */
export function newProxyRow(over: Partial<ProxyRowState> = {}): ProxyRowState {
  localIdCounter += 1;
  return {
    localId: `proxy-row-${localIdCounter}`,
    scheme: ProxyScheme.HTTP,
    host: '',
    port: '',
    username: '',
    password: '',
    ...over,
  };
}

const ENTRY_PATTERN = /^(http|https|socks5|socks5h):\/\/(.+):(\d{1,5})$/;

/**
 * Splits `[user:pass@]host` on the LAST `@` (so a password may contain `@`)
 * and the credential half on the FIRST `:` (so a password may contain `:`
 * too — this can misparse a password that itself contains `:`, but the only
 * time this function runs against a real value is the empty string, since
 * the setting is write-only and resets to `''` on both save and cancel; a
 * non-empty `value` here would mean the surrounding admin panel started
 * showing a saved secret back, which it never does).
 */
function splitHostAuth(middle: string): { host: string; username: string; password: string } {
  const at = middle.lastIndexOf('@');
  if (at === -1) {
    return { host: middle, username: '', password: '' };
  }
  const creds = middle.slice(0, at);
  const colon = creds.indexOf(':');
  return {
    host: middle.slice(at + 1),
    username: colon === -1 ? creds : creds.slice(0, colon),
    password: colon === -1 ? '' : creds.slice(colon + 1),
  };
}

/** The editor's rows for a comma/newline-separated proxy-list string. Never
 * empty: an unparseable or blank value still yields one empty row to edit. */
export function parseProxyRows(value: string): ProxyRowState[] {
  const rows = splitProxyList(value)
    .map((entry) => {
      const match = ENTRY_PATTERN.exec(entry);
      if (!match) {
        return null;
      }
      const [, scheme, middle, port] = match;
      return newProxyRow({ scheme: scheme as ProxyScheme, port, ...splitHostAuth(middle) });
    })
    .filter((row): row is ProxyRowState => row !== null);
  return rows.length > 0 ? rows : [newProxyRow()];
}

/** `null` when the row is not yet complete (host/port empty) — such a row is
 * silently excluded from the saved value rather than reported as invalid. */
export function formatProxyRow(row: ProxyRowState): string | null {
  const host = row.host.trim();
  const port = row.port.trim();
  if (!host || !port) {
    return null;
  }
  const username = row.username.trim();
  const auth = username ? `${username}:${row.password}@` : '';
  return `${row.scheme}://${auth}${host}:${port}`;
}

export function formatProxyRows(rows: ProxyRowState[]): string {
  return rows
    .map(formatProxyRow)
    .filter((entry): entry is string => entry !== null)
    .join(',');
}
