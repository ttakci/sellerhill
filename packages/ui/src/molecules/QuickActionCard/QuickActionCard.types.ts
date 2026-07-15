import type React from 'react';

export type QuickActionCardVariant = 'default' | 'brand';

export interface QuickActionCardProps {
  /** Card title (primary line). */
  title: string;
  /** Optional description shown under the title. */
  subtitle?: string;
  /** Click handler — the whole card is clickable. */
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** `brand` renders the title + arrow accent in the brand color. */
  variant?: QuickActionCardVariant;
  className?: string;
}
