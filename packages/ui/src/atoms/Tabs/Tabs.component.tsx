import type React from 'react';

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
      <S.Rail
        items={items.map(({ id, label, icon }) => ({ id, label, icon }))}
        value={activeTab}
        onChange={onTabClick}
        variant={variant}
      />
      <S.Content>{activeContent}</S.Content>
    </S.Container>
  );
};

TabsComponent.displayName = 'TabsComponent';
