import type { AmazonAccountStatus } from './amazon.enums';

export class AmazonAccountPublicDto {
  id!: string;
  userId!: string;
  label?: string;
  email!: string;
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
}
