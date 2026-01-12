import { type IconName } from './icons';

export type { IconName };

export type IconSize = number | 'sm' | 'md' | 'lg';

export interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  isLoading?: boolean;
}
