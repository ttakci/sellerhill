import type React from 'react';

import { Icon } from '../Icon';

import * as S from './TabNav.style';
import type { TabNavProps } from './TabNav.types';

export const TabNav: React.FC<TabNavProps> = ({
  items,
  value,
  onChange,
  variant = 'underline',
  ariaLabel,
  className,
}) => {
  return (
    <S.TabList $variant={variant} className={className} role="tablist" aria-label={ariaLabel}>
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
          </S.TabButton>
        );
      })}
    </S.TabList>
  );
};

TabNav.displayName = 'TabNav';
