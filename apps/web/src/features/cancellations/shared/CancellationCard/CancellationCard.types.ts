import type { CancellationRowView } from '../../cancellations.types';

export interface CancellationCardProps {
  row: CancellationRowView;
  /** Opens the request's detail drawer. */
  onOpen?: () => void;
  className?: string;
}
