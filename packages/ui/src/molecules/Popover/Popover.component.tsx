import type React from 'react';

import * as S from './Popover.style';
import type { PopoverComponentProps } from './Popover.types';

export const PopoverComponent = ({
  trigger,
  content,
  position,
  isOpen,
  className,
  wrapperRef,
  onToggle,
}: PopoverComponentProps): React.ReactElement => {
  return (
    <S.PopoverWrapper ref={wrapperRef} className={className}>
      <S.TriggerWrapper onClick={onToggle}>
        {trigger}
      </S.TriggerWrapper>
      {isOpen && (
        <S.PopoverContent $position={position}>
          <S.PopoverArrow $position={position} />
          {content}
        </S.PopoverContent>
      )}
    </S.PopoverWrapper>
  );
};

PopoverComponent.displayName = 'PopoverComponent';
