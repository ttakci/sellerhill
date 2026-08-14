import type React from 'react';
import { createPortal } from 'react-dom';

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
  isMobile,
  containerRef,
  onTriggerClick,
  onItemClick,
  onClose,
}) => {
  const renderMobileSheet = () => {
    if (!isOpen) {return null;}

    return createPortal(
      <S.MobileOverlay onClick={onClose}>
        <S.BottomSheet onClick={(e) => e.stopPropagation()}>
          <S.BottomSheetHandle />
          {header && <S.BottomSheetHeader>{header}</S.BottomSheetHeader>}
          <S.BottomSheetItems>
            {items.map((item, index) => (
              <S.MobileMenuItem
                key={index}
                onClick={() => onItemClick(item)}
                $variant={item.variant}
              >
                {item.icon && <Icon name={item.icon} size={20} />}
                {item.label}
              </S.MobileMenuItem>
            ))}
          </S.BottomSheetItems>
          <S.MobileSafeAreaSpacer />
        </S.BottomSheet>
      </S.MobileOverlay>,
      document.body
    );
  };

  return (
    <S.Container ref={containerRef} className={className}>
      <S.TriggerWrapper onClick={onTriggerClick}>{trigger}</S.TriggerWrapper>
      {isMobile ? (
        renderMobileSheet()
      ) : (
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
      )}
    </S.Container>
  );
};

DropdownComponent.displayName = 'DropdownComponent';
