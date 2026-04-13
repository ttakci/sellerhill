import React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './ViewToggle.style';
import type { ViewToggleProps } from './ViewToggle.types';

export const ViewToggle = ({
  viewMode,
  onViewModeChange,
  gridLabel,
  tableLabel,
}: ViewToggleProps): React.ReactElement => {
  return (
    <S.ViewToggleGroup>
      <S.ToggleButton
        $active={viewMode === 'grid'}
        onClick={() => onViewModeChange('grid')}
        title={gridLabel ?? 'Grid'}
      >
        <Icon name="grid-view" size={20} />
      </S.ToggleButton>
      <S.ToggleButton
        $active={viewMode === 'table'}
        onClick={() => onViewModeChange('table')}
        title={tableLabel ?? 'Table'}
      >
        <Icon name="format-list-bulleted" size={20} />
      </S.ToggleButton>
    </S.ViewToggleGroup>
  );
};

ViewToggle.displayName = 'ViewToggle';
