import type React from 'react';

import type { CancellationRowView } from '../../cancellations.types';

export interface CancellationCardProps {
  row: CancellationRowView;
  /** Opens the request's detail drawer. */
  onOpen?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
}
