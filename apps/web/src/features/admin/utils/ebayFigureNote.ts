import type { TFunction } from 'i18next';

/**
 * The age sentence for eBay's own `getRateLimits` figures ("captured N
 * minutes/hours ago"). A plain helper, not a hook — it reads `Date.now()`,
 * which the render-purity lint refuses inside a component or hook body, so
 * the container calls this instead of inlining the computation.
 */
export function buildEbayFigureNote(fetchedAt: string | null, language: string, t: TFunction): string {
  if (!fetchedAt) {
    return '';
  }
  const at = new Date(fetchedAt);
  const minutes = Math.round((at.getTime() - Date.now()) / 60_000);
  const hours = Math.round(minutes / 60);
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  const relative =
    Math.abs(minutes) < 60
      ? rtf.format(minutes, 'minute')
      : Math.abs(hours) < 24
        ? rtf.format(hours, 'hour')
        : rtf.format(Math.round(hours / 24), 'day');
  return t('admin.ebayLimits.figuresAsOf', { time: at.toLocaleString(language), relative });
}
