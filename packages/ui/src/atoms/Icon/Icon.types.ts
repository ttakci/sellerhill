import { iconMap } from './icons';

/**
 * Union of every registered icon name. Derived from `iconMap`, which is typed
 * with `satisfies` rather than `: Record<string, …>` — the annotation widened
 * this to `string`, so a misspelled icon compiled fine and only warned at
 * runtime.
 */
export type IconName = keyof typeof iconMap;

export type IconSize = number | 'sm' | 'md' | 'lg';

export interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  /**
   * Solid variant. Lucide glyphs are stroke-drawn, so an "active/selected" state
   * is expressed by filling the path rather than by a second icon set.
   * `true` fills with the resolved stroke color; a string fills with that color
   * (accepts theme dot-paths, e.g. 'semantic.warning').
   */
  filled?: boolean | string;
  isLoading?: boolean;
  className?: string;
  style?: React.CSSProperties;
}
