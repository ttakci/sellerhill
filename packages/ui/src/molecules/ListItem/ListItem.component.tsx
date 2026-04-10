import React from 'react';

import * as S from './ListItem.style';
import type { ListItemProps } from './ListItem.types';

export const ListItem = ({
  icon,
  title,
  subtitle,
  action,
  onClick,
  selected = false,
  className,
}: ListItemProps): React.ReactElement => {
  return (
    <S.ListItemContainer
      $clickable={!!onClick}
      $selected={selected}
      className={className}
      onClick={onClick}
    >
      {icon && <S.ListItemIcon>{icon}</S.ListItemIcon>}
      <S.ListItemContent>
        <S.ListItemTitle>{title}</S.ListItemTitle>
        {subtitle && <S.ListItemSubtitle>{subtitle}</S.ListItemSubtitle>}
      </S.ListItemContent>
      {action && <S.ListItemAction>{action}</S.ListItemAction>}
    </S.ListItemContainer>
  );
};

ListItem.displayName = 'ListItem';
