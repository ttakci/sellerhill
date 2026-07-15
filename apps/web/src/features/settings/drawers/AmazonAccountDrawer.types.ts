import type { AmazonAccountPublicDto } from '@repo/shared';

export interface AmazonAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** When provided, the drawer opens in edit mode prefilled with this account. */
  editingAccount?: AmazonAccountPublicDto | null;
  /** When provided, a back button is rendered (returns to the accounts list). */
  onBack?: () => void;
}
