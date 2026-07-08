import { useEffect, useRef, useState } from 'react';

import { CollapsibleComponent } from './Collapsible.component';
import type { CollapsibleProps } from './Collapsible.types';

export const Collapsible = ({
  title,
  children,
  defaultOpen = false,
  icon,
  onChange,
  className,
}: CollapsibleProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      setMaxHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    onChange?.(next);
  };

  return (
    <CollapsibleComponent
      title={title}
      icon={icon}
      className={className}
      isOpen={isOpen}
      maxHeight={maxHeight}
      contentRef={contentRef}
      onToggle={toggle}
    >
      {children}
    </CollapsibleComponent>
  );
};

Collapsible.displayName = 'Collapsible';
