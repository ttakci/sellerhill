import { readFileSync } from 'fs';
import { join } from 'path';

import { ConfigService } from '@nestjs/config';
import { EBAY_FINANCES_SCOPE, EBAY_MARKETPLACE, EBAY_OAUTH_CONSTANTS, hasFinancesScope } from '@repo/shared';

import { EbayOAuthService } from './ebay-oauth.service';

const config = new ConfigService({
  EBAY_CLIENT_ID: 'id',
  EBAY_CLIENT_SECRET: 'secret',
  EBAY_RUNAME: 'runame',
  EBAY_ENVIRONMENT: 'production',
  EBAY_AUTH_URL: 'https://auth.ebay.com/oauth2/authorize',
  EBAY_TOKEN_URL: 'https://api.ebay.com/identity/v1/oauth2/token',
  EBAY_REST_API_URL: 'https://api.ebay.com',
});

const scopesIn = (url: string): string[] => (new URL(url).searchParams.get('scope') ?? '').split(' ');

describe('the finances scope is chosen per consent', () => {
  const oauth = new EbayOAuthService(config);

  it('is not requested by default', () => {
    expect(oauth.getScopes()).toEqual([...EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES]);
    const { url } = oauth.generateConsentUrl(EBAY_MARKETPLACE.US, 'user-1');
    expect(scopesIn(url)).not.toContain(EBAY_FINANCES_SCOPE);
  });

  it('is requested, and remembered in the state, when asked for', () => {
    const { url, state } = oauth.generateConsentUrl(EBAY_MARKETPLACE.US, 'user-1', true);
    expect(scopesIn(url)).toContain(EBAY_FINANCES_SCOPE);
    expect(oauth.validateState(state)).toEqual({
      userId: 'user-1',
      marketplaceId: EBAY_MARKETPLACE.US,
      includeFinances: true,
    });
    expect(oauth.getScopes(true)).toContain(EBAY_FINANCES_SCOPE);
  });

  it('reads a state minted before this change as "no finances"', () => {
    const legacy = Buffer.from(
      JSON.stringify({ userId: 'user-1', marketplaceId: EBAY_MARKETPLACE.US, random: 'r', timestamp: Date.now() })
    ).toString('base64url');
    expect(oauth.validateState(legacy).includeFinances).toBe(false);
  });

  it('hasFinancesScope reads granted_scopes', () => {
    expect(hasFinancesScope(null)).toBe(false);
    expect(hasFinancesScope([...EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES])).toBe(false);
    expect(hasFinancesScope([EBAY_FINANCES_SCOPE])).toBe(true);
  });

  it('the callback records what the consent asked for, not the current switch', () => {
    const src = readFileSync(join(__dirname, 'ebay.service.ts'), 'utf8');
    const start = src.indexOf('async handleCallback(');
    const body = src.slice(start, src.indexOf('private async subscribeToMessages(', start));
    expect(body).toMatch(/includeFinances\s*\}\s*=\s*this\.oauthService\.validateState\(state\)/);
    expect(body).not.toMatch(/EBAY_OAUTH_FINANCES_SCOPE_ENABLED/);
    expect(body.match(/this\.oauthService\.getScopes\(includeFinances\)/g)?.length).toBe(2);
  });
});
