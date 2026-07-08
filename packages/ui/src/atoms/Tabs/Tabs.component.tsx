import type React from 'react';

import { Icon } from '../Icon';

import * as S from './Tabs.style';
import type { TabsComponentProps } from './Tabs.types';

export const TabsComponent: React.FC<TabsComponentProps> = ({
  items,
  className,
  variant = 'underline',
  activeTab,
  activeContent,
  onTabClick,
}) => {
  return (
    <S.Container className={className}>
      <S.TabList $variant={variant}>
        {items.map((item) => (
          <S.TabButton
            key={item.id}
            $isActive={activeTab === item.id}
            $variant={variant}
            onClick={() => onTabClick(item.id)}
          >
            {item.icon && <Icon name={item.icon} size={18} />}
            {item.label}
          </S.TabButton>
        ))}
      </S.TabList>
      <S.Content>{activeContent}</S.Content>
    </S.Container>
  );
};

TabsComponent.displayName = 'TabsComponent';
