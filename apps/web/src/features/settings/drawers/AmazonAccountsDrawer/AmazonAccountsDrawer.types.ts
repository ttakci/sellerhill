import type { AmazonAccountPublicDto, AmazonAccountStatus } from '@repo/shared';

export interface AmazonAccountsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AmazonAccountPublicDto[];
  onEdit: (id: string) => void;
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
  /** Reason the last verification failed — shown under an invalid card. */
  lastVerificationError?: string;
}

export interface AmazonAccountsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AmazonAccountCardView[];
  /** Currently selected account id, or null when nothing is selected. */
  selectedId: string | null;
  /** True until a card is selected — disables the footer "Continue" action. */
  isContinueDisabled: boolean;
  /** Selects (or toggles off) a card by id. */
  onSelect: (id: string) => void;
  /** Opens the edit flow for the currently selected account. */
  onContinue: () => void;
}
