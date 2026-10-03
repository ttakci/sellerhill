import { Dropdown, Icon } from '@repo/ui';
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
  if (!hasMenu) {
    return (
      <S.StaticLabel title={activeLabel}>
        <S.Label>{activeLabel}</S.Label>
      </S.StaticLabel>
    );
  }
  return (
    <Dropdown
      align="right"
      width="14rem"
      trigger={
        <S.Trigger aria-label={t('translation:header.selectStore')} title={activeLabel}>
          <S.Label>{activeLabel}</S.Label>
          <Icon name="chevron-down" size={12} />
        </S.Trigger>
      }
      items={items}
    />
  );
};
