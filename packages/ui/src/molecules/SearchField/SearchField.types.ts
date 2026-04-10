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
