import React from 'react';

import { Icon } from '../../atoms/Icon';
import { useTheme } from '../../hooks/useTheme';

import * as S from './ThemeToggle.style';

export const ThemeToggle: React.FC = () => {
  const { themeMode, toggleTheme } = useTheme();

  return (
    <S.ToggleButton
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} mode`}
    >
      <Icon name={themeMode === 'light' ? 'moon' : 'sun'} size={20} />
    </S.ToggleButton>
  );
};
