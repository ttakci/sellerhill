import { createPortal } from 'react-dom';

import * as S from './Tooltip.style';
import type { TooltipComponentProps } from './Tooltip.types';

export const TooltipComponent = ({
  content,
  children,
  position,
  variant,
  visible,
  coords,
  wrapperRef,
  contentRef,
  onMouseEnter,
  onMouseLeave,
}: TooltipComponentProps) => {
  return (
    <S.TooltipWrapper ref={wrapperRef} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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

TooltipComponent.displayName = 'TooltipComponent';
