import type React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './SearchField.style';
import type { SearchFieldComponentProps } from './SearchField.types';

export const SearchFieldComponent: React.FC<SearchFieldComponentProps> = ({
  value,
  onChange,
  placeholder,
  size = 'medium',
  variant = 'default',
  fullWidth = false,
  className,
  id,
  autoFocus,
  disabled,
  name,
  'aria-label': ariaLabel,
  onKeyDown,
}) => {
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
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        disabled={disabled}
        name={name}
        aria-label={ariaLabel}
      />
    </S.SearchContainer>
  );
};

SearchFieldComponent.displayName = 'SearchFieldComponent';
