import type { OrderDto } from '@repo/shared';

export interface OrderDetailsPageProps {
  order: OrderDto | undefined;
  isLoading: boolean;
  isUpdating: boolean;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  statusLabel: string;
  roiLabel: string;
  totalAmazonCost: number;
  onBack: () => void;
  onCopyAddress: () => void;
  onOpenLinkAmazon: () => void;
  onOpenAmazonOrderUrl?: () => void;
  canCopyAddress: boolean;
}
