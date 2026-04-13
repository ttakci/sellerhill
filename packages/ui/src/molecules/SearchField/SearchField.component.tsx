import React, { useCallback } from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './SearchField.style';
import type { SearchFieldProps } from './SearchField.types';

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder,
  onSearch,
  size = 'medium',
  variant = 'default',
  fullWidth = false,
  className,
  id,
  autoFocus,
  disabled,
  name,
  'aria-label': ariaLabel,
}) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        onSearch();
      }
    },
    [onSearch],
  );

  return (
    <S.SearchContainer
      $size={size}
      $variant={variant}
      $fullWidth={fullWidth}
      className={className}
    >
      <S.SearchIconWrapper>
        <Icon name="search" size={size === 'large' ? 20 : 16} />
      </S.SearchIconWrapper>
      <S.SearchInput
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        name={name}
        aria-label={ariaLabel}
      />
    </S.SearchContainer>
  );
};

SearchField.displayName = 'SearchField';
