import { Dropdown, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './StoreSwitcher.style';
import type { StoreSwitcherProps } from './StoreSwitcher.types';

export const StoreSwitcherComponent = ({
  visible,
  activeLabel,
  hasMenu,
  items,
}: StoreSwitcherProps): React.ReactElement | null => {
  const { t } = useTranslation(['translation']);
  if (!visible) {
    return null;
  }
  const name = (
    <S.Name>
      <Text variant="body-sm" weight="semibold" color="text.primary" truncate>
        {activeLabel}
      </Text>
    </S.Name>
  );
  if (!hasMenu) {
    return (
      <S.StaticLabel>
        <Icon name="storefront" size={18} color="brand.primary" />
        {name}
      </S.StaticLabel>
    );
  }
  return (
    <Dropdown
      align="right"
      width="14rem"
      trigger={
        <S.Trigger aria-label={t('translation:header.selectStore')}>
          <Icon name="storefront" size={18} color="brand.primary" />
          {name}
          <Icon name="chevron-down" size={12} />
        </S.Trigger>
      }
      items={items}
    />
  );
};
