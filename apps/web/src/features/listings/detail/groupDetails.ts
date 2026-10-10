import { TemplateType, buildListingTemplateContext, renderListingTemplate, resolvePriceEndingCents } from '@repo/shared';
import type * as Shared from '@repo/shared';

import { buildMarginRangeDetails, summarizeMarginStrategy } from '../shared/margin-strategy';

import type { GroupDetailDeps, GroupDetailRow, GroupDetailSection, GroupPreviewListing } from './ListingDetailPage.types';

import { predefinedTemplateName } from '@/features/settings/utils/predefinedTemplateLabel';

const NS = 'listingSettingsGroup:listingSettingsGroup';

const findPredefined = (
  group: Shared.ListingSettingsGroup,
  templates: ReadonlyArray<Shared.PredefinedTemplateResponse>
): Shared.PredefinedTemplateResponse | undefined =>
  templates.find((tpl) => tpl.id === group.templates?.predefinedTemplateId);

/**
 * Read-only mirror of the group edit drawer, step by step (general · deductions ·
 * pricing · listing rules · template), so a seller choosing a group sees what it
 * does. Labels reuse the edit drawer's own keys; nothing here edits a group.
 */
export function buildGroupDetailSections(
  group: Shared.ListingSettingsGroup,
  templates: ReadonlyArray<Shared.PredefinedTemplateResponse>,
  deps: GroupDetailDeps
): GroupDetailSection[] {
  const { t, fmtCurrency, fmtRating, dash } = deps;
  const k = (key: string): string => t(`${NS}.${key}`);
  const on = t('listings.detail.automationBadgeActive');
  const off = t('listings.detail.automationBadgeOff');
  const flag = (value: boolean | undefined): string[] => [value ? on : off];
  const num = (value: number | null | undefined): string[] => [typeof value === 'number' ? String(value) : dash];
  const money = (value: number | null | undefined): string[] => [
    typeof value === 'number' ? fmtCurrency(value) : dash,
  ];
  const row = (label: string, values: string[]): GroupDetailRow => ({ label, values });

  const rules = group.listingRules;
  const fees = group.fees;
  const ending = resolvePriceEndingCents(fees);
  const tiers = buildMarginRangeDetails(group.repricingStrategy, fmtCurrency, t, dash);
  const marginValues = tiers.length > 1 ? tiers : [summarizeMarginStrategy(group.repricingStrategy, fmtCurrency, t) ?? dash];

  const outOfStock =
    typeof rules.outOfStockEndDays === 'number'
      ? t(`${NS}.rules.cleanup.afterDays`, { count: rules.outOfStockEndDays })
      : k('rules.cleanup.never');
  const coldDays = rules.coldListingDays;

  const general: GroupDetailRow[] = [
    row(k('groupName'), [group.name]),
    ...(group.description ? [row(k('description'), [group.description])] : []),
    row(k('ebayStockQuantity'), num(group.stock?.defaultQuantity)),
    row(k('stockBuffer'), num(group.stock?.stockBuffer)),
    row(k('stripBrandFromTitle'), flag(group.content?.stripBrandFromTitle)),
    row(k('aiTitleEnabled'), flag(group.content?.aiTitleEnabled)),
  ];

  const deductions: GroupDetailRow[] = [
    row(k('ebayFee'), [typeof fees?.ebayFeePercent === 'number' ? `%${fees.ebayFeePercent}` : dash]),
    row(k('fixedFee'), money(fees?.fixedFeeAmount)),
  ];

  const pricing: GroupDetailRow[] = [
    row(k('profitMargin'), marginValues),
    row(k('priceRounding.title'), [ending === null ? off : `.${String(ending).padStart(2, '0')}`]),
  ];

  const ruleRows: GroupDetailRow[] = [
    row(k('rules.brand.vero'), flag(rules.veroProtectionEnabled)),
    row(k('rules.brand.hideBrand'), flag(rules.hideBrand)),
    row(k('rules.filters.minPrice'), money(rules.minSourcePrice)),
    row(k('rules.filters.maxPrice'), money(rules.maxSourcePrice)),
    row(k('rules.filters.amazonShippedOnly'), flag(rules.amazonShippedOnly)),
    row(k('rules.filters.primeOnly'), flag(rules.primeOnly)),
    row(k('rules.filters.pesticideProtection'), flag(rules.pesticideProtection)),
    row(k('rules.filters.minRating'), [typeof rules.minRating === 'number' ? fmtRating(rules.minRating) : dash]),
    row(k('rules.filters.minReviewCount'), num(rules.minReviewCount)),
    row(k('rules.cleanup.outOfStock'), [outOfStock]),
    row(
      k('rules.cleanup.cold'),
      typeof coldDays === 'number' ? [t(`${NS}.rules.cleanup.afterDays`, { count: coldDays })] : [off]
    ),
    ...(typeof coldDays === 'number'
      ? [row(k('rules.cleanup.coldMode'), [rules.coldListingAutoEnd ? k('rules.cleanup.coldMode_end') : k('rules.cleanup.coldMode_flag')])]
      : []),
  ];

  const predefined = findPredefined(group, templates);
  const templateName =
    group.templates?.type === TemplateType.CUSTOM
      ? k('custom')
      : predefined
        ? predefinedTemplateName(t, predefined)
        : dash;

  return [
    { key: 'general', title: k('generalSettings'), rows: general },
    { key: 'deductions', title: k('drawer.deductions'), rows: deductions },
    { key: 'pricing', title: k('pricingStrategy'), rows: pricing },
    { key: 'rules', title: k('rules.title'), rows: ruleRows },
    { key: 'template', title: k('htmlTemplate'), rows: [row(k('activeTemplate'), [templateName])] },
  ];
}

/**
 * The group's template rendered with THIS listing's own data through the shared
 * renderer (same one publish uses). Brand, ASIN, price, currency, condition and
 * quantity are deliberately not passed — templates may not use them.
 */
/**
 * Wraps rendered template HTML into a standalone document for a SANDBOXED
 * iframe (`sandbox=""`, `srcDoc`). The preview carries third-party product data
 * (Amazon description/features), so it must never be injected into the app
 * document: the sandbox blocks scripts and event handlers and keeps the
 * template's CSS out of the app. eBay itself only receives the server-side
 * sanitized copy.
 */
export function buildPreviewDocument(html: string): string {
  if (!html.trim()) {
    return '';
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font-family:sans-serif;}img{max-width:100%;height:auto;}</style></head><body>${html}</body></html>`;
}

export function renderGroupTemplatePreview(
  group: Shared.ListingSettingsGroup | undefined,
  templates: ReadonlyArray<Shared.PredefinedTemplateResponse>,
  listing: GroupPreviewListing
): string {
  if (!group) {
    return '';
  }
  const html =
    group.templates?.type === TemplateType.CUSTOM
      ? (group.templates.customTemplateHtml ?? '')
      : (findPredefined(group, templates)?.htmlContent ?? '');
  if (!html.trim()) {
    return '';
  }
  return renderListingTemplate(
    html,
    buildListingTemplateContext({
      title: listing.title,
      description: listing.description,
      features: listing.features,
      specs: listing.specs,
      mainImageUrl: listing.imageUrls?.[0],
    })
  );
}
