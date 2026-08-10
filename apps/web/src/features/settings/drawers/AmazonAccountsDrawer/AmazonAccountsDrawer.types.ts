import type { AmazonAccountPublicDto } from '@repo/shared';

import type { AmazonAccountCardView } from '@/features/settings/components/AmazonAccountCard';

export interface AmazonAccountsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AmazonAccountPublicDto[];
  /** Opens the create-account form. */
  onAddNew: () => void;
  /** Opens the full accounts list drawer. */
  onViewAll: () => void;
  /** Opens the edit form for the clicked account. */
  onEdit: (id: string) => void;
}

export interface AmazonAccountsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AmazonAccountCardView[];
  onAddNew: () => void;
  onViewAll: () => void;
  onEdit: (id: string) => void;
}
