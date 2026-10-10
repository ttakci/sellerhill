import React from 'react';

import { IconName } from '../../atoms/Icon';

export type SettingsCardVariant = 'section' | 'panel';

export interface SettingsCardHeaderProps {
  icon?: IconName;
  title: string;
  subtitle?: string;
  variant?: SettingsCardVariant;
  /** Title at the bold weight instead of semibold — for a page whose cards are
   *  its section headings (the listing detail). Off by default, so the settings
   *  hub and every other card keep their quieter titles. */
  emphasis?: boolean;
}

export interface SettingsCardProps {
  variant?: SettingsCardVariant;
  header?: SettingsCardHeaderProps;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** The rule under a section card's header. On by default; off for a card
   *  whose body is its own bordered panes (the order detail's summaries). */
  showHeaderDivider?: boolean;
}
