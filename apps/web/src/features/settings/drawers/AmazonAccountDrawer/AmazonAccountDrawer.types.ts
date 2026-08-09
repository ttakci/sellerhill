import type { AmazonAccountPublicDto } from '@repo/shared';
import type React from 'react';

export interface AmazonAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, the drawer opens in edit mode prefilled with this account. */
  editingAccount?: AmazonAccountPublicDto | null;
  /** When provided, a back button is rendered (returns to the accounts list). */
  onBack?: () => void;
}

/** The credential + auto-fulfil fields the drawer edits. */
export interface AmazonAccountDrawerFields {
  label: string;
  email: string;
  password: string;
  twoFactorSecret: string;
  autoFulfillEnabled: boolean;
  /** Held as a string so the field can be cleared; empty means "no cap". */
  autoFulfillCapTotal: string;
}

/** Presentation props — the container owns state, prefill and the mutations. */
export interface AmazonAccountDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  /** i18n key prefix for the drawer title and subtitle. */
  prefix: string;
  fields: AmazonAccountDrawerFields;
  isSaving: boolean;
  onFieldChange: (
    field: keyof Omit<AmazonAccountDrawerFields, 'autoFulfillEnabled'>
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoFulfillEnabledChange: (checked: boolean) => void;
  onSave: () => void;
}
