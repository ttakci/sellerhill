import type { DropdownItem } from '@repo/ui';

export interface StoreSwitcherProps {
  /** Nothing renders with no connected store. */
  visible: boolean;
  /** The active store's name, shown on the trigger. */
  activeLabel: string;
  /** One store: a plain label, no menu. */
  hasMenu: boolean;
  items: DropdownItem[];
}
