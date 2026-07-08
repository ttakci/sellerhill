import type React from 'react';

export type SearchFieldSize = 'medium' | 'large';
export type SearchFieldVariant = 'default' | 'gray';

export interface SearchFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  onSearch?: () => void;
  size?: SearchFieldSize;
  variant?: SearchFieldVariant;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  name?: string;
  'aria-label'?: string;
}

export interface SearchFieldComponentProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  size?: SearchFieldSize;
  variant?: SearchFieldVariant;
  fullWidth?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  name?: string;
  'aria-label'?: string;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}
