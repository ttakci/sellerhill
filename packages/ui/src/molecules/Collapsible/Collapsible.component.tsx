import React, { useEffect, useRef, useState } from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './Collapsible.style';
import type { CollapsibleProps } from './Collapsible.types';

export const Collapsible = ({
  title,
  children,
  defaultOpen = false,
  icon,
  onChange,
  className,
}: CollapsibleProps): React.ReactElement => {
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
    <S.CollapsibleContainer className={className}>
      <S.CollapsibleHeader $isOpen={isOpen} onClick={toggle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {icon}
          {title}
        </span>
        <span className="collapsible-chevron">
          <Icon name="chevron-down" size="sm" />
        </span>
      </S.CollapsibleHeader>
      <S.CollapsibleContent $isOpen={isOpen} $maxHeight={isOpen ? maxHeight : null} ref={contentRef}>
        {children}
      </S.CollapsibleContent>
    </S.CollapsibleContainer>
  );
};

Collapsible.displayName = 'Collapsible';
