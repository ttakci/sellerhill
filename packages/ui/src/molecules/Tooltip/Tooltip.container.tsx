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

  useEffect(() => {
    if (!visible) {return;}
    const frame = requestAnimationFrame(() => {
      updatePosition();
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, updatePosition]);

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
    >
      {children}
    </TooltipComponent>
  );
};

Tooltip.displayName = 'Tooltip';
