import { useEffect, useRef, useState } from 'react';

import { DropdownComponent } from './Dropdown.component';
import type { DropdownProps } from './Dropdown.types';

const MOBILE_BREAKPOINT_PX = 640;

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
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // On mobile the menu is a bottom sheet portaled to document.body — it
    // lives outside containerRef's DOM subtree, and its own Overlay handles
    // closing. Attaching this listener there would close the sheet on any
    // tap inside it.
    if (!isOpen || isMobile) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  const handleTrigger = () => {
    setIsOpen(!isOpen);
  };

  const handleItemClick = (item: { onClick: () => void }) => {
    item.onClick();
    setIsOpen(false);
  };

  const handleClose = () => {
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
      isMobile={isMobile}
      containerRef={containerRef}
      onTriggerClick={handleTrigger}
      onItemClick={handleItemClick}
      onClose={handleClose}
    />
  );
};

Dropdown.displayName = 'Dropdown';
