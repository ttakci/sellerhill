import type { LegalDocument, LegalDocumentKey, SupportedLocale } from '@repo/shared';

/**
 * Props for the routed container. One container serves every legal document —
 * the route picks which one, so adding the terms of service is a route entry
 * plus a block of i18n, not a second page.
 */
export interface LegalDocumentPageContainerProps {
  documentKey: LegalDocumentKey;
}

export interface LegalDocumentPageProps {
  /** Null when the resource is missing or malformed — the page shows its own empty state. */
  document: LegalDocument | null;
  currentLocale: SupportedLocale;
  /** Resolved in the container — a component may not compute values. */
  currentYear: number;
  onLocaleChange: (locale: SupportedLocale) => void;
  onNavigateHome: () => void;
}
