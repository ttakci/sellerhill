import { useCallback, useEffect, useRef, useState } from 'react';

import { TooltipComponent } from './Tooltip.component';
import type { TooltipProps } from './Tooltip.types';

export const Tooltip = ({
  content,
  children,
  position = 'top',
  variant = 'dark',
  delay = 200,
}: TooltipProps) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) {return;}
    const rect = wrapperRef.current.getBoundingClientRect();
    const gap = 10;

    let top = 0;
    let left = 0;

    if (position === 'top') {
      top = rect.top - gap;
      left = rect.left + rect.width / 2;
    } else if (position === 'bottom') {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2;
    } else if (position === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - gap;
    } else {
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
    }

    setCoords({ top, left });
  }, [position]);

  const show = useCallback(
    (_e: React.MouseEvent) => {
      updatePosition();
      timerRef.current = setTimeout(() => {
        updatePosition();
        setVisible(true);
      }, delay);
    },
    [delay, updatePosition]
  );

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const toggle = useCallback(() => {
    clearTimeout(timerRef.current);
    updatePosition();
    setVisible((current) => !current);
  }, [updatePosition]);

  const showImmediately = useCallback(() => {
    clearTimeout(timerRef.current);
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      hide();
    }
  }, [hide]);

  useEffect(() => {
    if (!visible) {return;}
    const frame = requestAnimationFrame(() => {
      updatePosition();
    });
    const handleDocumentClick = (event: MouseEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        hide();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        hide();
      }
    };
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, updatePosition, hide]);

  return (
    <TooltipComponent
      content={content}
      position={position}
      variant={variant}
      visible={visible}
      coords={coords}
      wrapperRef={wrapperRef}
      contentRef={contentRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={toggle}
      onFocus={showImmediately}
      onBlur={handleBlur}
    >
      {children}
    </TooltipComponent>
  );
};

Tooltip.displayName = 'Tooltip';
