import type React from 'react';

import type { IconName } from '../../atoms/Icon';

export type QuickActionCardVariant = 'default' | 'brand' | 'solid';

export interface QuickActionCardProps {
  /** Card title (primary line). */
  title: string;
  /** Optional description shown under the title. */
  subtitle?: string;
  /** Click handler — the whole card is clickable. */
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** `brand` renders the title + arrow accent in the brand color; `solid` fills the card with the brand gradient. */
  variant?: QuickActionCardVariant;
  /** Optional leading icon (rendered in a tinted tile). */
  icon?: IconName;
  className?: string;
}
