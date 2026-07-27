import React from 'react';

import { renderMarkdown } from './safe-markdown-parser';
import * as S from './SafeMarkdown.style';
import type { SafeMarkdownProps } from './SafeMarkdown.types';

/**
 * SafeMarkdown — renders a strict allowlisted subset of markdown to React
 * nodes. The parser never uses `dangerouslySetInnerHTML`; every character is
 * either part of an allowlisted construct (paragraph / strong / em / inline
 * code / fenced code / lists / line breaks / citation markers) or rendered as
 * literal escaped text. Raw HTML, images, iframes, and external links are
 * inert by construction.
 *
 * Stateless molecule (component + style + types + index), matching the
 * MessageModal / Dialog convention.
 */
export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({
  source,
  emptyState,
  className,
  codeScroll = true,
}) => {
  if (!source || source.trim().length === 0) {
    return emptyState ? <>{emptyState}</> : null;
  }

  return (
    <S.Root $codeScroll={codeScroll} className={className}>
      {renderMarkdown(source)}
    </S.Root>
  );
};

SafeMarkdown.displayName = 'SafeMarkdown';
