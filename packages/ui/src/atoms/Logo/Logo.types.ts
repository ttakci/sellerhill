export interface LogoProps {
  /** Preferred render height in px; the logo shrinks when its container is narrower. */
  height?: number;
  /** @deprecated Use `height`. */
  size?: number;
  className?: string;
  /** Retained for source compatibility; every layout uses the canonical delivered artwork. */
  layout?: 'default' | 'full' | 'wordmark';
  onClick?: () => void;
}
