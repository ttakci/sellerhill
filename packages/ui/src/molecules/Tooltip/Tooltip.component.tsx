import React, { useCallback, useRef, useState } from 'react';

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
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  return (
    <S.TooltipWrapper onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <S.TooltipContent $position={position} $variant={variant}>
          {content}
        </S.TooltipContent>
      )}
    </S.TooltipWrapper>
  );
};

Tooltip.displayName = 'Tooltip';
