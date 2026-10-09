import type React from 'react';

import { Icon } from '../Icon';

import * as S from './TabNav.style';
import type { TabNavComponentProps } from './TabNav.types';

export const TabNavComponent: React.FC<TabNavComponentProps> = ({
  items,
  value,
  onChange,
  variant = 'underline',
  ariaLabel,
  className,
  listRef,
}) => {
  return (
    <S.TabList ref={listRef} $variant={variant} className={className} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <S.TabButton
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            $isActive={isActive}
            $variant={variant}
            onClick={() => onChange(item.id)}
          >
            {item.icon && <Icon name={item.icon} size="sm" />}
            {item.label}
            {item.count !== undefined && <S.TabCount $isActive={isActive}>{item.count}</S.TabCount>}
          </S.TabButton>
        );
      })}
    </S.TabList>
  );
};

TabNavComponent.displayName = 'TabNavComponent';
