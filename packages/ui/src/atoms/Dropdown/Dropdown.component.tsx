import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import * as S from './Dropdown.style';
import type { DropdownProps } from './Dropdown.types';

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  header,
  align = 'right',
  direction = 'down',
  width,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTrigger = () => {
    setIsOpen(!isOpen);
  };

  const renderedTrigger = typeof trigger === 'function' 
    ? (trigger as any)(isOpen) // React 18 / TS might need generic, but this is safe for now
    : trigger;

  return (
    <S.Container ref={containerRef} className={className}>
      <div onClick={handleTrigger} style={{ cursor: 'pointer' }}>{renderedTrigger}</div>
      <S.Menu $isOpen={isOpen} $align={align} $direction={direction} $width={width}>
        {header && <S.DropdownHeader>{header}</S.DropdownHeader>}
        {items.map((item, index) => (
          <S.MenuItem
            key={index}
            onClick={() => {
              item.onClick();
              setIsOpen(false);
            }}
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
