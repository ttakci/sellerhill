import React, { useCallback, useEffect, useRef, useState } from 'react';

import * as S from './Popover.style';
import type { PopoverProps } from './Popover.types';

export const Popover = ({
  trigger,
  content,
  position = 'bottom',
  isOpen: controlledIsOpen,
  onOpenChange,
  className,
}: PopoverProps): React.ReactElement => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  const wrapperRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);

  const close = useCallback(() => {
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, close]);

  return (
    <S.PopoverWrapper ref={wrapperRef} className={className}>
      <div onClick={toggle} style={{ display: 'inline-flex' }}>
        {trigger}
      </div>
      {isOpen && (
        <S.PopoverContent $position={position}>
          <S.PopoverArrow $position={position} />
          {content}
        </S.PopoverContent>
      )}
    </S.PopoverWrapper>
  );
};

Popover.displayName = 'Popover';
