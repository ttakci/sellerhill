import type { AmazonAccountStatus } from '@repo/shared';

/**
 * Pre-formatted, presentation-ready view of a connected Amazon account. The
 * mapper derives the localized "connected since" date so the card component
 * stays free of formatters/logic.
 */
export interface AmazonAccountCardView {
  id: string;
  displayName: string;
  email: string;
  connectedSince: string;
  status: AmazonAccountStatus;
  /** Reason the last verification failed — shown under an invalid card. */
  lastVerificationError?: string;
  /** Whether a 2FA secret is stored for this account. */
  hasTwoFactor: boolean;
  /** A2 auto-fulfillment eligibility — see `AmazonAccountPublicDto`. */
  autoFulfillEnabled: boolean;
  /** Per-account spend ceiling (USD); only meaningful when `autoFulfillEnabled`. */
  autoFulfillCapTotal: number | null;
}

export interface AmazonAccountCardProps {
  account: AmazonAccountCardView;
  /** Present → the card is clickable (opens edit) and shows hover/focus affordance. */
  onClick?: () => void;
}
