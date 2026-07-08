import { useEffect, useRef, useState } from 'react';

import { DropdownComponent } from './Dropdown.component';
import type { DropdownProps } from './Dropdown.types';

export const Dropdown = ({
  trigger,
  items,
  header,
  align = 'right',
  direction = 'down',
  width,
  className,
}: DropdownProps) => {
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

  const handleItemClick = (item: { onClick: () => void }) => {
    item.onClick();
    setIsOpen(false);
  };

  const renderedTrigger = typeof trigger === 'function' ? trigger(isOpen) : trigger;

  return (
    <DropdownComponent
      trigger={renderedTrigger}
      items={items}
      header={header}
      align={align}
      direction={direction}
      width={width}
      className={className}
      isOpen={isOpen}
      containerRef={containerRef}
      onTriggerClick={handleTrigger}
      onItemClick={handleItemClick}
    />
  );
};

Dropdown.displayName = 'Dropdown';
