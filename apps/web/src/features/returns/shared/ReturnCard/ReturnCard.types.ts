import type { ReturnRowView } from '../../returns.types';

export interface ReturnCardProps {
  row: ReturnRowView;
  /** Opens the return's detail drawer. */
  onOpen?: () => void;
  className?: string;
}
