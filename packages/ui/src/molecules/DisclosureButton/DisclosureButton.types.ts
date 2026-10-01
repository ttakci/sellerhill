import type React from 'react';

export interface DisclosureButtonProps {
  /** The section's title — rendered as the heading of the row. */
  label: string;
  /** Secondary facts beside the title (a count, a "changed" badge). Wraps on narrow screens. */
  meta?: React.ReactNode;
  /** Whether the section this row controls is expanded. Controlled only. */
  isOpen: boolean;
  /** Fired when the row is clicked. */
  onToggle: () => void;
  /** `id` of the region the row expands, for `aria-controls`. */
  controlsId?: string;
}
