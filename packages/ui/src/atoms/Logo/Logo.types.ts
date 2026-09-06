export interface LogoProps {
  /** Preferred render height in px; the logo shrinks when its container is narrower. */
  height?: number;
  /** @deprecated Use `height`. */
  size?: number;
  className?: string;
  /** `wordmark` renders the icon-less lettermark (`/logo-wordmark.svg`); `default` and `full` render the full badge + wordmark artwork. */
  layout?: 'default' | 'full' | 'wordmark';
  onClick?: () => void;
}
