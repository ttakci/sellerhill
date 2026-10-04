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

describe('sell.finances is part of every consent', () => {
  const oauth = new EbayOAuthService(config);

  it('is a default scope', () => {
    expect(EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES).toContain(EBAY_FINANCES_SCOPE);
    expect(oauth.getScopes()).toContain(EBAY_FINANCES_SCOPE);
  });

  it('is in the consent URL', () => {
    const { url } = oauth.generateConsentUrl(EBAY_MARKETPLACE.US, 'user-1');
    expect(scopesIn(url)).toContain(EBAY_FINANCES_SCOPE);
  });

  it('a state minted before this change (with or without `fin`) still validates', () => {
    for (const extra of [{}, { fin: false }, { fin: true }]) {
      const legacy = Buffer.from(
        JSON.stringify({
          userId: 'user-1',
          marketplaceId: EBAY_MARKETPLACE.US,
          random: 'r',
          timestamp: Date.now(),
          ...extra,
        })
      ).toString('base64url');
      expect(oauth.validateState(legacy)).toEqual({ userId: 'user-1', marketplaceId: EBAY_MARKETPLACE.US });
    }
  });

  it('hasFinancesScope reads granted_scopes', () => {
    expect(hasFinancesScope(null)).toBe(false);
    expect(hasFinancesScope([...EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES])).toBe(true);
  });

  it('no switch is read anywhere any more', () => {
    for (const file of ['ebay.service.ts', 'ebay-oauth.service.ts']) {
      const src = readFileSync(join(__dirname, file), 'utf8');
      expect(src).not.toMatch(/FINANCES_SCOPE_ENABLED|includeFinances/);
    }
  });
});
