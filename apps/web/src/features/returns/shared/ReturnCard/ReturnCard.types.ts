import type React from 'react';

import type { ReturnRowView } from '../../returns.types';

export interface ReturnCardProps {
  row: ReturnRowView;
  /** Opens the return's detail drawer. */
  onOpen?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
}
