export type SkeletonRadius = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface SkeletonProps {
  /** CSS width value, e.g. '100%', '4rem' */
  width?: string;
  /** CSS height value, e.g. '1rem', '4rem' */
  height?: string;
  /** Corner radius token */
  radius?: SkeletonRadius;
  /** Renders a perfect circle (avatars/thumbnails) — overrides radius */
  circle?: boolean;
  className?: string;
}
