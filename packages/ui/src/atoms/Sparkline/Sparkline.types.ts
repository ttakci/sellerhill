export type SparklineTone = 'positive' | 'negative' | 'neutral';
export type SparklineSize = 'sm' | 'md';

export interface SparklineProps {
  values: number[];
  tone?: SparklineTone;
  /** Accessible description (already translated); without it the chart is decorative. */
  ariaLabel?: string;
  size?: SparklineSize;
  className?: string;
}
