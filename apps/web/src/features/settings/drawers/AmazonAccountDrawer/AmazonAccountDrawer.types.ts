import type { AmazonAccountDrawerStep, AmazonAccountPublicDto, AmazonMarketplace, ProxyConnectionType } from '@repo/shared';
import type { StepItem } from '@repo/ui';
import type React from 'react';

export interface AmazonAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, the drawer opens in edit mode prefilled with this account. */
  editingAccount?: AmazonAccountPublicDto | null;
  /** When provided, a back button is rendered (returns to the accounts list). */
  onBack?: () => void;
}

/** Toggle/select fields with their own dedicated change handler (not plain text inputs). */
type NonTextField = 'autoFulfillEnabled' | 'proxyEnabled' | 'proxyConnectionType' | 'marketplace';

/**
 * Which fields on the ACCOUNT step failed the required check on the last
 * "Continue" press. All false until the user actually tries to advance —
 * empty fields are flagged on the attempt, never pre-emptively (frontend-rules
 * required-field validation).
 */
export interface AmazonAccountFieldErrors {
  email: boolean;
  password: boolean;
  /**
   * A TOTP secret is mandatory — this flag is true whenever the field is
   * empty, on create AND on edit. On edit the field is prefilled with the
   * (non-empty) stored-secret mask, so an untouched edit passes; focusing the
   * field clears the mask, after which a real value must be typed.
   */
  twoFactorSecret: boolean;
  autoFulfillCapTotal: boolean;
}

/** The credential + auto-fulfil + self-service proxy fields the drawer edits. */
export interface AmazonAccountDrawerFields {
  label: string;
  email: string;
  password: string;
  twoFactorSecret: string;
  /** Storefront this buyer account operates on. Set at creation, immutable after. */
  marketplace: AmazonMarketplace;
  autoFulfillEnabled: boolean;
  /** Held as a string so the field can be cleared; empty means "no cap". */
  autoFulfillCapTotal: string;
  // Self-service proxy (migration 080) — replaces the platform-paid pool. If
  // the user doesn't configure one, browser automation for this account runs
  // bare-IP; there is no platform fallback.
  proxyEnabled: boolean;
  proxyConnectionType: ProxyConnectionType;
  proxyHost: string;
  /** Held as a string so the field can be cleared. */
  proxyPort: string;
  proxyUsername: string;
  /** Write-only; left blank on edit means "keep the stored password". */
  proxyPassword: string;
}

/** Presentation props — the container owns state, prefill and the mutations. */
export interface AmazonAccountDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  /** i18n key prefix for the drawer title and subtitle. */
  prefix: string;
  /** True in edit mode — locks the marketplace select (immutable after creation). */
  isEdit: boolean;
  fields: AmazonAccountDrawerFields;
  isSaving: boolean;
  /** Which step of the flow is showing. */
  step: AmazonAccountDrawerStep;
  /** Stepper labels, one per AmazonAccountDrawerStep, built from i18n. */
  steps: StepItem[];
  /** Per-field required errors for the ACCOUNT step (see AmazonAccountFieldErrors). */
  accountFieldErrors: AmazonAccountFieldErrors;
  /** Advance to the next step — validates the current step first and stays put if it fails. */
  onNext: () => void;
  /** Return to the previous step (distinct from `onBack`, which leaves the drawer). */
  onStepBack: () => void;
  onFieldChange: (
    field: keyof Omit<AmazonAccountDrawerFields, NonTextField>
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  /**
   * Clears the stored-secret mask the instant the 2FA field is focused, so the
   * user always types into an empty input. No-op unless the field currently
   * holds the mask (create mode, or an already-edited value).
   */
  onTwoFactorSecretFocus: () => void;
  onAutoFulfillEnabledChange: (checked: boolean) => void;
  onProxyEnabledChange: (checked: boolean) => void;
  onProxyConnectionTypeChange: (value: ProxyConnectionType) => void;
  onMarketplaceChange: (value: AmazonMarketplace) => void;
  onSave: () => void;
}
