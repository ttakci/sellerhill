import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CopyableTextComponent } from './CopyableText.component';
import type { CopyableTextProps } from './CopyableText.types';

/** How long the "copied" tooltip state lingers before reverting to the label. */
const COPIED_FLASH_MS = 1500;

/**
 * Wraps a piece of text so hovering shows what it copies (e.g. "Copy street")
 * and clicking copies just that value — mirroring how eBay's own order detail
 * page lets a seller copy each address field individually rather than the
 * whole block at once.
 */
export const CopyableText = ({ value, label, copiedLabel, children, className }: CopyableTextProps): React.ReactElement => {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(() => {
    if (!value) {
      return;
    }
    void navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIsCopied(false), COPIED_FLASH_MS);
    });
  }, [value]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLSpanElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCopy();
      }
    },
    [handleCopy]
  );

  return (
    <CopyableTextComponent
      value={value}
      label={label}
      copiedLabel={copiedLabel}
      isCopied={isCopied}
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      className={className}
    >
      {children}
    </CopyableTextComponent>
  );
};

CopyableText.displayName = 'CopyableText';
