import type { AmazonAccountStatus, AmazonMarketplace } from './amazon.enums';
import type { ProxyConnectionType } from './amazon.types';

export class AmazonAccountPublicDto {
  id!: string;
  userId!: string;
  label?: string;
  email!: string;
  // Storefront this buyer account operates on (migration 081). Immutable
  // after creation — set once at create, never accepted by UpdateAmazonAccountDto.
  marketplace!: AmazonMarketplace;
  status!: AmazonAccountStatus;
  hasTwoFactor?: boolean;
  lastVerificationError?: string | null;
  lastVerifiedAt?: string;
  lastUsedAt?: string;
  createdAt!: string;
  updatedAt!: string;
  // A2 auto-fulfillment per-account overrides (migration 037).
  // - autoFulfillEnabled: this account is eligible to be picked for auto-checkout.
  // - autoFulfillCapTotal: per-account spend ceiling (USD); NULL disables the account.
  // - autoFulfillDryRun: when true, run the full checkout flow up to (not incl.)
  //   Place Order so the review total can be captured and surfaced for review.
  autoFulfillEnabled!: boolean;
  autoFulfillCapTotal!: number | null;
  autoFulfillDryRun!: boolean;
  // Self-service proxy (migration 080) — user-supplied, replaces the platform
  // pool. Password is never returned; `hasProxyPassword` only signals presence.
  proxyEnabled!: boolean;
  proxyConnectionType!: ProxyConnectionType | null;
  proxyHost!: string | null;
  proxyPort!: number | null;
  proxyUsername!: string | null;
  hasProxyPassword!: boolean;
}
