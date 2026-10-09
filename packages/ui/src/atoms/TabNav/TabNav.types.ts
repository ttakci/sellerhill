import type React from 'react';

import type { IconName } from '../Icon';

/** One entry in a tab rail. Navigation only — the caller owns the panel. */
export interface TabNavItem {
  id: string;
  label: string;
  icon?: IconName;
  /**
   * A count beside the label (open items, rows in this tab), rendered as a
   * small pill. Preferred over baking "(5)" into the label — the figure gets
   * tabular numerals and its own quiet surface, and the label stays a word.
   */
  count?: number;
}

export interface TabNavProps {
  items: TabNavItem[];
  /** Currently selected tab id (controlled). */
  value: string;
  onChange: (tabId: string) => void;
  /**
   * `underline` = page-level section navigation (the app default).
   * `pill` = compact in-card switch.
   */
  variant?: 'underline' | 'pill';
  /** Accessible name for the rail, e.g. "Admin sections". */
  ariaLabel?: string;
  className?: string;
}

/** What the container hands the presentational rail. */
export interface TabNavComponentProps extends TabNavProps {
  /** The rail element, so the container can keep the selected tab in view. */
  listRef: React.RefObject<HTMLDivElement>;
}
