import type React from 'react';

import type { MessageType } from '../../context';

export interface InfoMessageProps {
  children: React.ReactNode;
  /**
   * Semantic weight. `info` (the default) is the quiet blue note this atom has
   * always been — white disc, tinted glyph, no border — so every existing call
   * site is untouched.
   *
   * `warning` / `error` / `success` switch the WHOLE treatment at once: the
   * matching tint, a semantic hairline, and a SOLID disc with a white glyph,
   * exactly as `Dialog`/`MessageModal` paint it. Selecting the format with one
   * prop is deliberate — copying only half of it (the disc, say) and leaving
   * the rest on the surrounding component's scale is how a failure surface
   * quietly becomes a softer dialect of the popup instead of matching it.
   */
  type?: MessageType;
  /** Label for an optional action button, e.g. "Fix payment". Same
   *  action/onAction/isActionLoading shape as EmptyState, so a hint that grows
   *  a call-to-action does not need a different API to learn. */
  action?: string;
  onAction?: () => void;
  isActionLoading?: boolean;
  className?: string;
}
