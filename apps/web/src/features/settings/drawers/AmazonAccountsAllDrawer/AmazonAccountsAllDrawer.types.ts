import type { AmazonAccountPublicDto } from '@repo/shared';

import type { AmazonAccountCardView } from '@/features/settings/components/AmazonAccountCard';

export interface AmazonAccountsAllDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  accounts: AmazonAccountPublicDto[];
  onEdit: (id: string) => void;
}

export interface AmazonAccountsAllDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
  accounts: AmazonAccountCardView[];
  onEdit: (id: string) => void;
}
