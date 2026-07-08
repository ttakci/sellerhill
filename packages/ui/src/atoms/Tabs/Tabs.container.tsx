import { useState } from 'react';

import { TabsComponent } from './Tabs.component';
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
    <TabsComponent
      items={items}
      className={className}
      variant={variant}
      activeTab={activeTab || ''}
      activeContent={activeContent}
      onTabClick={handleTabClick}
    />
  );
};

Tabs.displayName = 'Tabs';
