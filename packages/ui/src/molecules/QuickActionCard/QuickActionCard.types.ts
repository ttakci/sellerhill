import React from 'react';

import type { IconName } from '../../atoms/Icon';

export type QuickActionCardVariant = 'default' | 'brand';

export interface QuickActionCardProps {
  /** Icon name from the Icon atom */
  icon: IconName;
  /** Card title */
  title: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Click handler */
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Visual variant */
  variant?: QuickActionCardVariant;
  className?: string;
}
