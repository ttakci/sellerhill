import type { ReactNode } from 'react';

/**
 * SafeMarkdown — renders a strict allowlisted subset of markdown to React
 * nodes. NO `dangerouslySetInnerHTML`, NO external sanitizer dependency, NO
 * raw HTML pass-through. See `safe-markdown-parser.tsx` for the allowlist.
 *
 * Stateless molecule: it has no internal state, so it follows the stateless
 * convention (component + style + types + index) like MessageModal / Dialog.
 */
export interface SafeMarkdownProps {
  /** Raw markdown source (untrusted string). */
  source: string;
  /** Render an empty-state node when `source` is empty/whitespace. */
  emptyState?: ReactNode;
  /** Extra class on the root. */
  className?: string;
  /**
   * When true, fenced code blocks render with horizontal scroll instead of
   * wrapping long lines (default: true — preserves code formatting).
   */
  codeScroll?: boolean;
}
