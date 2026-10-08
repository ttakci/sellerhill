import { DEFAULT_LISTING_RULES, TemplateType } from '@repo/shared';
import type * as Shared from '@repo/shared';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { buildGroupDetailSections, buildPreviewDocument, renderGroupTemplatePreview } from './groupDetails';

describe('buildPreviewDocument', () => {
  it('wraps the rendered HTML in a standalone UTF-8 document for the sandboxed iframe', () => {
    const doc = buildPreviewDocument('<p>Ürün</p>');
    expect(doc.startsWith('<!doctype html>')).toBe(true);
    expect(doc).toContain('<meta charset="utf-8">');
    expect(doc).toContain('<body><p>Ürün</p></body>');
  });

  it('returns an empty string for an empty template so no frame is drawn', () => {
    expect(buildPreviewDocument('')).toBe('');
    expect(buildPreviewDocument('   ')).toBe('');
  });
});

const t = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}|${JSON.stringify(opts)}` : key) as unknown as TFunction;
const fmtCurrency = (v: number) => `$${v.toFixed(2)}`;
const fmtRating = (v: number) => v.toFixed(1);
const dash = '—';
const deps = { t, fmtCurrency, fmtRating, dash };

const template = {
  id: 'tpl-1',
  slug: 'ds-general-store',
  name: 'General Store',
  htmlContent: '<h1>{{title}}</h1><p>{{{asin}}}|{{price}}|{{brand}}</p><img src="{{main_image}}">',
} as unknown as Shared.PredefinedTemplateResponse;

const group = (over: Partial<Shared.ListingSettingsGroup> = {}): Shared.ListingSettingsGroup =>
  ({
    id: 'g1',
    name: 'Everyday',
    repricingStrategy: [
      { id: 'a', minPrice: 0, maxPrice: 25, profitMarginPercent: 25 },
      { id: 'b', minPrice: 25, maxPrice: 100, profitMarginPercent: 18 },
    ],
    stock: { defaultQuantity: 5, stockBuffer: 1 },
    fees: { ebayFeePercent: 12.35, fixedFeeAmount: 0.3, priceRoundingEnabled: true, priceEndingCents: 99 },
    templates: { type: TemplateType.PREDEFINED, predefinedTemplateId: 'tpl-1' },
    content: { stripBrandFromTitle: true, aiTitleEnabled: false, aiDescriptionEnabled: false },
    listingRules: { ...DEFAULT_LISTING_RULES },
    ...over,
  }) as unknown as Shared.ListingSettingsGroup;

const rows = (g: Shared.ListingSettingsGroup) =>
  buildGroupDetailSections(g, [template], deps).flatMap((s) => s.rows);
const row = (g: Shared.ListingSettingsGroup, labelPart: string) => rows(g).find((r) => r.label.includes(labelPart));

describe('buildGroupDetailSections', () => {
  it('returns five sections in the edit drawer order', () => {
    expect(buildGroupDetailSections(group(), [template], deps).map((s) => s.key)).toEqual([
      'general',
      'deductions',
      'pricing',
      'rules',
      'template',
    ]);
  });

  it('puts every margin tier on its own line inside the margin row', () => {
    const margin = row(group(), 'profitMargin');
    expect(margin?.values).toHaveLength(2);
    expect(margin?.values[0]).toContain('groupMarginRow');
  });

  it('shows the single range summary when there is only one tier, and a dash with none', () => {
    const one = group({ repricingStrategy: [{ id: 'a', minPrice: 0, maxPrice: 10, profitMarginPercent: 20 }] });
    expect(row(one, 'profitMargin')?.values).toEqual(['%20']);
    expect(row(group({ repricingStrategy: [] }), 'profitMargin')?.values).toEqual([dash]);
  });

  it('formats fees and price ending', () => {
    const g = group();
    expect(row(g, 'ebayFee')?.values).toEqual(['%12.35']);
    expect(row(g, 'fixedFee')?.values).toEqual(['$0.30']);
    expect(row(g, 'priceRounding')?.values).toEqual(['.99']);
  });

  it('shows Off for a rule that is off and a dash for an unset price', () => {
    const g = group({ listingRules: { ...DEFAULT_LISTING_RULES, veroProtectionEnabled: false } });
    expect(row(g, 'rules.brand.vero')?.values).toEqual(['listings.detail.automationBadgeOff']);
    expect(row(g, 'rules.filters.minPrice')?.values).toEqual([dash]);
    expect(row(g, 'rules.filters.minRating')?.values).toEqual([dash]);
    expect(row(g, 'rules.cleanup.cold')?.values).toEqual(['listings.detail.automationBadgeOff']);
  });

  it('formats set rule values', () => {
    const g = group({
      listingRules: { ...DEFAULT_LISTING_RULES, minSourcePrice: 5, minRating: 4.5, minReviewCount: 20 },
    });
    expect(row(g, 'rules.filters.minPrice')?.values).toEqual(['$5.00']);
    expect(row(g, 'rules.filters.minRating')?.values).toEqual(['4.5']);
    expect(row(g, 'rules.filters.minReviewCount')?.values).toEqual(['20']);
  });

  it('names a predefined template by its catalog label and a custom one as custom', () => {
    expect(row(group(), 'activeTemplate')?.values[0]).toContain('ds-general-store');
    const custom = group({ templates: { type: TemplateType.CUSTOM, customTemplateHtml: '<p>x</p>' } });
    expect(row(custom, 'activeTemplate')?.values).toEqual(['listingSettingsGroup:listingSettingsGroup.custom']);
  });

  it('omits the description row when unset', () => {
    expect(row(group(), 'listingSettingsGroup.description')).toBeUndefined();
    expect(row(group({ description: 'Hello' }), 'listingSettingsGroup.description')?.values).toEqual(['Hello']);
  });
});

describe('renderGroupTemplatePreview', () => {
  const listing = {
    title: 'My Title',
    description: 'desc',
    features: ['a'],
    specs: { Color: 'Red' },
    imageUrls: ['https://i.example/1.jpg'],
  };

  it('renders the predefined template with this listing and never passes banned placeholders', () => {
    const html = renderGroupTemplatePreview(group(), [template], listing);
    expect(html).toContain('My Title');
    expect(html).toContain('https://i.example/1.jpg');
    expect(html).toContain('<p>||</p>');
  });

  it('renders the custom template html', () => {
    const custom = group({ templates: { type: TemplateType.CUSTOM, customTemplateHtml: '<b>{{title}}</b>' } });
    expect(renderGroupTemplatePreview(custom, [template], listing)).toBe('<b>My Title</b>');
  });

  it('is empty when there is no template html', () => {
    const custom = group({ templates: { type: TemplateType.CUSTOM, customTemplateHtml: '' } });
    expect(renderGroupTemplatePreview(custom, [template], listing)).toBe('');
    expect(renderGroupTemplatePreview(undefined, [template], listing)).toBe('');
  });
});
