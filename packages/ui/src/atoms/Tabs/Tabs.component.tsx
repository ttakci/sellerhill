import React, { useState } from 'react';

import { Icon } from '../Icon';

import * as S from './Tabs.style';
import type { TabsProps } from './Tabs.types';

export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultActiveTab,
  onChange,
  className,
  variant = 'underline',
}) => {
  const [activeTab, setActiveTab] = useState(defaultActiveTab || items[0]?.id);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (onChange) {
      onChange(tabId);
    }
  };

  const activeContent = items.find((item) => item.id === activeTab)?.content;

  return (
    <S.Container className={className}>
      <S.TabList $variant={variant}>
        {items.map((item) => (
          <S.TabButton
            key={item.id}
            $isActive={activeTab === item.id}
            $variant={variant}
            onClick={() => handleTabClick(item.id)}
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
