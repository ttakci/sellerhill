import React, { useRef, useState } from 'react';

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
  const contentRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    onChange?.(next);
  };

  const maxHeight = isOpen && contentRef.current ? contentRef.current.scrollHeight : null;

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
      <S.CollapsibleContent $isOpen={isOpen} $maxHeight={maxHeight} ref={contentRef}>
        {children}
      </S.CollapsibleContent>
    </S.CollapsibleContainer>
  );
};

Collapsible.displayName = 'Collapsible';
