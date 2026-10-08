import {
  ActionCenterSeverity,
  i18nResources,
  type ActionCenterItemKey,
  type PeriodMetricsDto,
} from '@repo/shared';

import { escapeHtml } from '../../common/utils/sanitize';

/**
 * The daily summary e-mail, rendered to template variables. Pure: every input
 * is a value, so the spec can drive it without a database.
 *
 * The DB template (`daily_digest`, migration 150) holds the static copy; only
 * the parts that repeat or vary are built here, and EVERY value placed into the
 * HTML is escaped first — `EmailService` substitutes variables verbatim.
 */

/** The two languages the template exists in; every other locale reads English. */
export type DigestContentLocale = 'en' | 'tr';

export interface DigestPendingItem {
  key: ActionCenterItemKey;
  severity: ActionCenterSeverity;
  count: number;
  /** Absolute link to the list that resolves it, or null. */
  url: string | null;
}

export interface DigestStoreRow {
  label: string;
  metrics: PeriodMetricsDto;
}

export interface DigestInput {
  locale: DigestContentLocale;
  firstName: string;
  /** The seller's local day the summary covers, `YYYY-MM-DD`. */
  reportDay: string;
  currency: string;
  total: PeriodMetricsDto;
  /** Stores that had orders that day; shown only when the account has several stores. */
  stores: DigestStoreRow[];
  /** Every eBay store the account has, active or not. */
  connectedStoreCount: number;
  cancelRequests: number;
  newReturns: number;
  pending: DigestPendingItem[];
}

export interface DigestRender {
  /** Nothing happened and nothing is waiting: the mail is not sent. */
  empty: boolean;
  variables: Record<string, string>;
}

const INTL_TAG: Record<DigestContentLocale, string> = { en: 'en-US', tr: 'tr-TR' };

/** Only critical and warning items are mailed — suggestions can wait for the app. */
export const DIGEST_PENDING_SEVERITIES: ReadonlySet<ActionCenterSeverity> = new Set([
  ActionCenterSeverity.CRITICAL,
  ActionCenterSeverity.WARNING,
]);

export function resolveDigestLocale(locale: string | null | undefined): DigestContentLocale {
  return locale === 'tr' ? 'tr' : 'en';
}

export function isDigestEmpty(input: Pick<
  DigestInput,
  'total' | 'cancelRequests' | 'newReturns' | 'pending'
>): boolean {
  return (
    input.total.orders === 0 &&
    input.total.refunds === 0 &&
    input.cancelRequests === 0 &&
    input.newReturns === 0 &&
    input.pending.length === 0
  );
}

export function renderDigest(input: DigestInput): DigestRender {
  const tag = INTL_TAG[input.locale];
  const money = new Intl.NumberFormat(tag, {
    style: 'currency',
    currency: input.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const count = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const fmtMoney = (value: number): string => escapeHtml(money.format(value));
  const fmtCount = (value: number): string => escapeHtml(count.format(value));

  const showStores = input.connectedStoreCount > 1 && input.stores.length > 0;

  return {
    empty: isDigestEmpty(input),
    variables: {
      firstName: escapeHtml(input.firstName.trim() || fallbackName(input.locale)),
      dayLabel: escapeHtml(formatDay(input.reportDay, tag)),
      orders: fmtCount(input.total.orders),
      sales: fmtMoney(input.total.sales),
      netProfit: fmtMoney(input.total.profitConfirmed),
      estimatedProfit: fmtMoney(input.total.profitProvisional),
      cancelledOrders: fmtCount(input.total.refunds),
      cancelRequests: fmtCount(input.cancelRequests),
      newReturns: fmtCount(input.newReturns),
      storesDisplay: showStores ? '' : 'display:none;mso-hide:all;',
      storesHtml: showStores ? renderStoreRows(input.stores, fmtMoney, fmtCount) : '',
      pendingHtml: renderPending(input.locale, input.pending, fmtCount),
    },
  };
}

function fallbackName(locale: DigestContentLocale): string {
  return locale === 'tr' ? 'değerli satıcı' : 'there';
}

/** `2026-10-07` → "October 7, 2026" / "7 Ekim 2026". Read at UTC: it is a calendar date, not an instant. */
function formatDay(reportDay: string, tag: string): string {
  return new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${reportDay}T00:00:00Z`));
}

const CELL = 'padding: 8px 6px; border-bottom: 1px solid #eef2f7; color: #27272a;';

function renderStoreRows(
  stores: DigestStoreRow[],
  fmtMoney: (value: number) => string,
  fmtCount: (value: number) => string,
): string {
  return [...stores]
    .sort((a, b) => b.metrics.sales - a.metrics.sales)
    .map(
      (store) =>
        `<tr><td style="${CELL}">${escapeHtml(store.label)}</td>` +
        `<td align="right" style="${CELL}">${fmtCount(store.metrics.orders)}</td>` +
        `<td align="right" style="${CELL}">${fmtMoney(store.metrics.sales)}</td>` +
        `<td align="right" style="${CELL}">${fmtMoney(store.metrics.profitConfirmed)}</td>` +
        `<td align="right" style="${CELL}">${fmtMoney(store.metrics.profitProvisional)}</td></tr>`,
    )
    .join('');
}

const BADGE: Record<string, string> = {
  [ActionCenterSeverity.CRITICAL]: 'background-color: #fef2f2; color: #b91c1c;',
  [ActionCenterSeverity.WARNING]: 'background-color: #fffbeb; color: #92400e;',
};

function renderPending(
  locale: DigestContentLocale,
  pending: DigestPendingItem[],
  fmtCount: (value: number) => string,
): string {
  const copy = actionCenterCopy(locale);
  if (pending.length === 0) {
    return `<div style="font-size: 14px; color: #475569;">${escapeHtml(copy.empty?.title ?? '')}</div>`;
  }
  const rows = pending
    .map((item) => {
      const title = escapeHtml(copy.items?.[item.key]?.title ?? item.key);
      const label = item.url
        ? `<a href="${escapeHtml(item.url)}" style="color: #1d4ed8; text-decoration: none;">${title}</a>`
        : title;
      const badge = BADGE[item.severity] ?? BADGE[ActionCenterSeverity.WARNING];
      return (
        `<tr><td width="48" valign="top" style="padding: 8px 12px 8px 0;">` +
        `<span style="display: inline-block; min-width: 28px; padding: 2px 6px; border-radius: 6px; ` +
        `text-align: center; font-size: 13px; font-weight: 700; ${badge}">${fmtCount(item.count)}</span></td>` +
        `<td valign="top" style="padding: 8px 0; font-size: 14px; color: #27272a;">${label}</td></tr>`
      );
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

interface ActionCenterCopy {
  empty?: { title?: string };
  items?: Record<string, { title?: string } | undefined>;
}

/** The Action Center's own titles — the same wording the seller reads in the app. */
function actionCenterCopy(locale: DigestContentLocale): ActionCenterCopy {
  const bundle = i18nResources[locale].actionCenter as { actionCenter?: ActionCenterCopy };
  return bundle.actionCenter ?? {};
}
