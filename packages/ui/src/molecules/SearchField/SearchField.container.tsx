import { useCallback } from 'react';

import { SearchFieldComponent } from './SearchField.component';
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
    <SearchFieldComponent
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      size={size}
      variant={variant}
      fullWidth={fullWidth}
      className={className}
      id={id}
      autoFocus={autoFocus}
      disabled={disabled}
      name={name}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
    />
  );
};

SearchField.displayName = 'SearchField';
