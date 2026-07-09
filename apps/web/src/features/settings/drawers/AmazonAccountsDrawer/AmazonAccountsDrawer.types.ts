import type { AmazonAccountPublicDto, AmazonAccountStatus } from '@repo/shared';

export interface AmazonAccountsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AmazonAccountPublicDto[];
  onAdd: () => void;
}

/**
 * Pre-formatted, presentation-ready view of a connected Amazon account.
 * The container derives the localized "connected since" date so the component
 * stays free of formatters/logic.
 */
export interface AmazonAccountCardView {
  id: string;
  displayName: string;
  email: string;
  connectedSince: string;
  status: AmazonAccountStatus;
}

export interface AmazonAccountsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AmazonAccountCardView[];
  onAdd: () => void;
}
