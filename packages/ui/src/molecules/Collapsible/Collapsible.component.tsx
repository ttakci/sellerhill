import styled from '@emotion/styled';
import React, { useEffect, useRef, useState } from 'react';

import { Icon } from '../../atoms/Icon';
import { tkn } from '../../theme/tkn';

import * as S from './Collapsible.style';
import type { CollapsibleProps } from './Collapsible.types';

const TitleWrapper = styled.span`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

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
        <TitleWrapper>
          {icon}
          {title}
        </TitleWrapper>
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
