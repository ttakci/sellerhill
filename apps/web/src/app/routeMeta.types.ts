export type NavSection = 'overview' | 'sales' | 'inventory' | 'discover' | 'configuration';

export interface AppRouteMeta {
  /** Path without locale prefix, e.g. `/listings/all` */
  path: string;
  /** Exact match unless endsWithMatch is set */
  match?: 'exact' | 'prefix';
  /**
   * Which static sidebar group ("Genel Bakış" / "Satışlar" / "Envanter" /
   * "Keşfet" / "Yapılandırma") the route belongs to. Documentary only — the
   * sidebar's item order is hand-authored in `AppLayout.component.tsx`, not
   * derived from this list.
   */
  section?: NavSection;
  /**
   * The page fills the content area and scrolls INSIDE its own panes (the
   * Messages inbox) instead of scrolling the page. `AppLayout` drops
   * `ContentInner`'s automatic minimum height on such a route so a
   * `flex: 1; min-height: 0` page container can take exactly the remaining
   * height. Every other route keeps the content-high page.
   */
  fitsViewport?: boolean;
  /** Breadcrumb segments after home (label keys resolved via t) */
  breadcrumbs: Array<{
    labelKey: string;
    /** When set, segment is a link (path without locale) */
    path?: string;
    ns?: string;
  }>;
}
