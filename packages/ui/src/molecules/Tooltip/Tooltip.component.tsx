import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import * as S from './Tooltip.style';
import type { TooltipProps } from './Tooltip.types';

export const Tooltip = ({
  content,
  children,
  position = 'top',
  variant = 'dark',
  delay = 200,
}: TooltipProps): React.ReactElement => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

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
    <S.TooltipWrapper ref={wrapperRef} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible &&
        createPortal(
          <S.TooltipPortal
            ref={contentRef}
            $position={position}
            $variant={variant}
            $top={coords.top}
            $left={coords.left}
          >
            {content}
          </S.TooltipPortal>,
          document.body
        )}
    </S.TooltipWrapper>
  );
};

Tooltip.displayName = 'Tooltip';
