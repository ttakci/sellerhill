import type React from 'react';

import type { ReturnRowView } from '../../returns.types';

export interface ReturnCardProps {
  row: ReturnRowView;
  /** Opens the order behind the return. Omitted when that order is not one we hold. */
  onOpen?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
}
