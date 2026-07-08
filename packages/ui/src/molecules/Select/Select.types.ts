import type React from 'react';
import { Control, FieldValues, Path, RegisterOptions } from 'react-hook-form';

import { IconName } from '../../atoms/Icon';

export interface SelectOption {
  label: string;
  value: string | number;
  icon?: IconName;
}

export type SelectSize = 'small' | 'medium' | 'large';

export interface SelectStandaloneComponentProps {
  value?: string | number;
  onChange?: (value: string | number) => void;
  error?: { message?: string };
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  iconLeft?: IconName;
  isDisabled?: boolean;
  fullWidth?: boolean;
  size?: SelectSize;
  searchPlaceholder?: string;
  noResultsMessage?: string;
  isSearchable?: boolean;
  // State from container
  isOpen: boolean;
  searchQuery: string;
  isMobile: boolean;
  dropdownStyle: React.CSSProperties;
  placement: 'bottom' | 'top';
  selectedOption: SelectOption | undefined;
  filteredOptions: SelectOption[];
  // Refs from container
  containerRef: React.RefObject<HTMLDivElement>;
  dropdownRef: React.RefObject<HTMLDivElement>;
  // Handlers from container
  onToggleDropdown: () => void;
  onSelect: (option: SelectOption) => void;
  onSearchChange: (value: string) => void;
  onClose: () => void;
}

export interface SelectProps<TFieldValues extends FieldValues = FieldValues> {
  name?: Path<TFieldValues>;
  control?: Control<TFieldValues>;
  rules?: RegisterOptions<TFieldValues, Path<TFieldValues>>;
  label?: string; // Made optional for cases like pagination
  options: SelectOption[];
  value?: string | number;
  onChange?: (value: string | number) => void;
  placeholder?: string;
  iconLeft?: IconName;
  isDisabled?: boolean;
  fullWidth?: boolean;
  isSearchable?: boolean;
  id?: string;
  error?: { message?: string };
  size?: SelectSize;
  searchPlaceholder?: string;
  noResultsMessage?: string;
}
