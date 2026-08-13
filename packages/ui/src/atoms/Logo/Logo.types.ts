export interface LogoProps {
  /** Render height in px; width scales with aspect ratio. */
  height?: number;
  /** @deprecated Use `height`. */
  size?: number;
  className?: string;
  /**
   * - `default` / `full` — icon over wordmark, stacked (auth branding panel)
   * - `nav` — icon + wordmark, side by side, no slogan (landing navbar)
   * - `stacked` — alias of `nav` (compat)
   * - `icon` — badge only, no wordmark, square aspect (collapsed sidebar rail)
   * - `wordmark` — two-tone text only, no badge ("Seller" + accent "Hill"),
   *   sellerboard-style expanded sidebar rail — pairs with `icon` on the
   *   collapse button
   */
  layout?: 'default' | 'full' | 'nav' | 'wordmark' | 'stacked' | 'icon';
  onClick?: () => void;
}
