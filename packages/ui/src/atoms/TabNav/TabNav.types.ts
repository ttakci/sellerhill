import type { IconName } from '../Icon';

/** One entry in a tab rail. Navigation only — the caller owns the panel. */
export interface TabNavItem {
  id: string;
  label: string;
  icon?: IconName;
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
