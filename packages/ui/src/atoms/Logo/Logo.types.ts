export interface LogoProps {
  /** Render height in px; width scales with aspect ratio. */
  height?: number;
  /** @deprecated Use `height`. */
  size?: number;
  className?: string;
  /**
   * Text-only wordmark in every case — there is no icon/badge graphic mark.
   * - `default` / `full` — sized for the auth branding panel; "seller" is
   *   hardcoded white for the always-dark aurora background.
   * - `wordmark` — "seller" uses `currentColor`, inheriting the ambient ink
   *   of whatever surface it renders on (sidebar, landing navbar/footer).
   */
  layout?: 'default' | 'full' | 'wordmark';
  onClick?: () => void;
}
