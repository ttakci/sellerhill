import type React from 'react';

import { Icon } from '../Icon';

import * as S from './Dropdown.style';
import type { DropdownComponentProps } from './Dropdown.types';

export const DropdownComponent: React.FC<DropdownComponentProps> = ({
  trigger,
  items,
  header,
  align,
  direction,
  width,
  className,
  isOpen,
  containerRef,
  onTriggerClick,
  onItemClick,
}) => {
  return (
    <S.Container ref={containerRef} className={className}>
      <S.TriggerWrapper onClick={onTriggerClick}>{trigger}</S.TriggerWrapper>
      <S.Menu $isOpen={isOpen} $align={align} $direction={direction} $width={width}>
        {header && <S.DropdownHeader>{header}</S.DropdownHeader>}
        {items.map((item, index) => (
          <S.MenuItem
            key={index}
            onClick={() => onItemClick(item)}
            $variant={item.variant}
          >
            {item.icon && <Icon name={item.icon} size={18} />}
            {item.label}
          </S.MenuItem>
        ))}
      </S.Menu>
    </S.Container>
  );
};

DropdownComponent.displayName = 'DropdownComponent';
