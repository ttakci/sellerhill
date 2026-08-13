import type { AmazonAccountPublicDto, AmazonMarketplace, ProxyConnectionType } from '@repo/shared';
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
  onFieldChange: (
    field: keyof Omit<AmazonAccountDrawerFields, NonTextField>
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoFulfillEnabledChange: (checked: boolean) => void;
  onProxyEnabledChange: (checked: boolean) => void;
  onProxyConnectionTypeChange: (value: ProxyConnectionType) => void;
  onMarketplaceChange: (value: AmazonMarketplace) => void;
  onSave: () => void;
}
