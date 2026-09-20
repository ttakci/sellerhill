import React from 'react';

import { Tooltip } from '../Tooltip';

import * as S from './CopyableText.style';
import type { CopyableTextComponentProps } from './CopyableText.types';

export const CopyableTextComponent = ({
  value,
  label,
  copiedLabel,
  isCopied,
  onClick,
  onKeyDown,
  children,
  className,
}: CopyableTextComponentProps): React.ReactElement => {
  // `Tooltip` itself toggles its own visibility on click of whatever it
  // wraps — without stopping propagation here, a click that copies (while
  // the tooltip is already open from the hover that preceded it) would also
  // toggle it straight back closed, hiding the "copied" confirmation before
  // it can be seen.
  const handleClick = (event: React.MouseEvent<HTMLSpanElement>): void => {
    event.stopPropagation();
    onClick();
  };

  return (
    <Tooltip content={isCopied ? copiedLabel : label} position="top" variant="dark">
      <S.Trigger
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={onKeyDown}
        className={className}
        aria-label={label}
      >
        {children ?? value}
      </S.Trigger>
    </Tooltip>
  );
};
