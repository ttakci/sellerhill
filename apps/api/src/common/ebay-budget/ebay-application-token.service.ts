import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Refresh the application token this long before eBay says it expires. */
const TOKEN_SAFETY_MS = 60_000;

/**
 * Both eBay calls made through the token this service mints get this timeout —
 * see `EbayAnalyticsService`'s equivalent constant for why (a stalled eBay
 * endpoint must not hang the caller for Node's default of ~300s).
 */
const TOKEN_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Mints and caches an eBay APPLICATION (client-credentials) token —
 * `https://api.ebay.com/oauth/api_scope`. There is no seller/store involved:
 * this is the keyset's own identity, used wherever a call is scoped to the
 * application rather than to a connected store (rate-limit introspection,
 * Notification API subscription management, ...).
 *
 * Extracted from `EbayAnalyticsService.applicationToken` (which was the only
 * caller until now) so a second application-scoped caller does not have to
 * duplicate the token cache or re-derive `restBase()`/`environment()`.
 */
@Injectable()
export class EbayApplicationTokenService {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async get(): Promise<string> {
    const clientId = this.config.get<string>('EBAY_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('EBAY_CLIENT_SECRET')?.trim();
    const tokenUrl = this.config.get<string>('EBAY_TOKEN_URL')?.trim();
    if (!clientId || !clientSecret || !tokenUrl) {
      throw new Error('eBay credentials not configured');
    }

    if (this.token && Date.now() < this.token.expiresAt - TOKEN_SAFETY_MS) {
      return this.token.value;
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // eBay wants the production scope string even against the sandbox host.
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
      signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`application token request failed (${response.status})`);
    }
    const parsed = JSON.parse(text) as { access_token?: string; expires_in?: number };
    if (!parsed.access_token) {
      throw new Error('application token response carried no access_token');
    }
    this.token = { value: parsed.access_token, expiresAt: Date.now() + (parsed.expires_in ?? 7200) * 1000 };
    return parsed.access_token;
  }

  /** `EBAY_REST_API_URL` without a trailing slash (defaults to https://api.ebay.com). */
  restBase(): string {
    return (this.config.get<string>('EBAY_REST_API_URL')?.trim() || 'https://api.ebay.com').replace(/\/+$/, '');
  }

  /** `EBAY_ENVIRONMENT` ('sandbox' | 'production'), used as the destinations table key. */
  environment(): string {
    return this.config.get<string>('EBAY_ENVIRONMENT')?.trim() || 'production';
  }
}
