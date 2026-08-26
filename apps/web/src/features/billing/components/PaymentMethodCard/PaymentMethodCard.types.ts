import type { BillingPaymentMethodDto } from '@repo/shared';

export interface PaymentMethodCardProps {
  paymentMethod: BillingPaymentMethodDto;
  onChange: () => void;
  isChangeLoading: boolean;
}
