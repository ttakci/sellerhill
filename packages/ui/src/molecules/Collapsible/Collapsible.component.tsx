import type React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './Collapsible.style';
import type { CollapsibleComponentProps } from './Collapsible.types';

export const CollapsibleComponent = ({
  title,
  children,
  icon,
  className,
  isOpen,
  maxHeight,
  contentRef,
  onToggle,
}: CollapsibleComponentProps): React.ReactElement => {
  return (
    <S.CollapsibleContainer className={className}>
      <S.CollapsibleHeader $isOpen={isOpen} onClick={onToggle}>
        <S.TitleWrapper>
          {icon}
          {title}
        </S.TitleWrapper>
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

CollapsibleComponent.displayName = 'CollapsibleComponent';
