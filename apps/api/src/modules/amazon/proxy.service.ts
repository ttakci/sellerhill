import { Injectable } from '@nestjs/common';

import { proxySessionToken } from './auto-fulfill-helpers';

export interface ProxyConfig {
  server: string;
  username: string;
  password: string;
}

/**
 * Zonds-provided residential proxy. Users never configure this.
 * Sticky session token = userId (perUser, default) or amazonAccountId (perAccount, reserved),
 * so each user (or account) always exits from the same residential IP across all Amazon traffic.
 * Returns null when proxy env is absent — callers fall back to a direct connection
 * (existing scraping MUST NOT regress when no proxy is configured).
 *
 * The sticky session is encoded in the username/password per the template — provider-agnostic.
 * Examples:
 *   - Smartproxy:    user `user-session-<token>-zone-residential`, password as-is.
 *   - Bright Data:   user `brigade-session-<token>`, password `password`.
 *   - IPRoyal:       user `user`, password `pass_session-<token>`.
 * Adjust PROXY_USER / PROXY_PASS_TEMPLATE env to the chosen provider's format.
 */
@Injectable()
export class ProxyService {
  private readonly endpoint = process.env.PROXY_ENDPOINT; // e.g. gate.smartproxy.com:7000
  private readonly user = process.env.PROXY_USER; // base username; may contain {session}
  private readonly passTpl = process.env.PROXY_PASS_TEMPLATE; // may contain {session}
  private readonly strategy = (process.env.PROXY_STRATEGY as 'perUser' | 'perAccount') || 'perUser';

  /** True iff a proxy provider is configured (required for auto-fulfill). */
  isConfigured(): boolean {
    return Boolean(this.endpoint && this.user);
  }

  resolve(userId: string, amazonAccountId: string): ProxyConfig | null {
    if (!this.isConfigured()) {return null;}
    const session = proxySessionToken(this.strategy, userId, amazonAccountId);
    const endpoint = this.endpoint as string;
    const baseUser = this.user as string;
    // Provider-specific: many residential providers encode the sticky session in the username
    // (e.g. user-session-<token>) or password. Adjust the template format to the chosen provider.
    const username = baseUser.includes('{session}')
      ? baseUser.replace('{session}', session)
      : `${baseUser}-session-${session}`;
    const password = this.passTpl ? this.passTpl.replace('{session}', session) : '';
    return { server: endpoint, username, password };
  }
}
