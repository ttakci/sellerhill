/**
 * Listing description template engine (Mustache subset).
 *
 * ONE renderer for both surfaces:
 * - the settings-drawer live preview (`apps/web`), and
 * - the eBay description actually published (`apps/api` listing create path).
 *
 * They used to be two different implementations with two different placeholder
 * vocabularies: the preview understood `{{{product_description}}}` /
 * `{{#feature_bullets}}…{{.}}…{{/feature_bullets}}` (the syntax every seeded
 * predefined template is written in), while the backend only replaced
 * `{{title}} {{description}} {{brand}} {{features}}` — and only for CUSTOM
 * templates. The result was raw `{{{product_description}}}` text rendered on
 * live eBay listings. Any new placeholder MUST be added here, once.
 *
 * Supported syntax:
 *   {{key}}            escaped value; an array renders as a <ul><li>…</li></ul>
 *   {{{key}}}          raw value (caller is responsible for sanitizing HTML)
 *   {{#key}}…{{.}}…{{/key}}   section: repeats per array item ({{.}} = item),
 *                              renders once for a truthy scalar, drops when empty
 *   {{^key}}…{{/key}}  inverted section: renders only when key is empty/falsy
 *
 * Plus three scalar presence flags — `has_features`, `has_details`,
 * `has_images` — for conditionally wrapping a LIST block. See
 * `LISTING_TEMPLATE_PRESENCE_FLAGS`.
 *
 * Anything left over after rendering (unknown keys, unbalanced sections) is
 * stripped by `stripUnresolvedPlaceholders` so template syntax can never reach
 * a buyer-visible listing.
 */

/** Value kinds a template placeholder can resolve to. */
export type ListingTemplateValue = string | string[] | number | null | undefined;

export type ListingTemplateContext = Record<string, ListingTemplateValue>;

/** Product-shaped input the canonical context is derived from. */
export interface ListingTemplateInput {
  title: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  asin?: string;
  category?: string;
  condition?: string;
  features?: string[];
  specs?: Record<string, string>;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  quantity?: number;
}

/**
 * Canonical placeholders, surfaced in the UI so users authoring a custom
 * template are not guessing. Aliases exist for backwards compatibility with
 * templates written against the old backend vocabulary.
 */
export const LISTING_TEMPLATE_PLACEHOLDERS = [
  'title',
  'product_description',
  'feature_bullets',
  'product_details',
  'main_image',
  'images',
  'brand',
  'manufacturer',
  'asin',
  'category',
  'condition',
  'price',
  'currency',
  'quantity',
] as const;

export type ListingTemplatePlaceholder = (typeof LISTING_TEMPLATE_PLACEHOLDERS)[number];

/** Old backend vocabulary → canonical key. Kept so existing custom templates keep working. */
const PLACEHOLDER_ALIASES: Record<string, ListingTemplatePlaceholder> = {
  description: 'product_description',
  product_title: 'title',
  features: 'feature_bullets',
  specs: 'product_details',
  image: 'main_image',
  main_image_url: 'main_image',
};

/** Default template used when a group has no usable template configured. */
export const DEFAULT_LISTING_TEMPLATE_HTML = `<div class="sellerhill-listing">
  <h1>{{title}}</h1>
  {{#main_image}}<p><img src="{{.}}" alt="{{title}}" style="max-width:100%;height:auto;" /></p>{{/main_image}}
  {{#product_description}}<div class="sellerhill-description">{{{product_description}}}</div>{{/product_description}}
  {{#feature_bullets}}<ul><li>{{.}}</li></ul>{{/feature_bullets}}
  {{#product_details}}<ul><li>{{.}}</li></ul>{{/product_details}}
</div>`;

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toDisplayString(value: ListingTemplateValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return String(value);
}

function isEmptyValue(value: ListingTemplateValue): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value);
  }
  return value.trim().length === 0;
}

/**
 * Presence flags for the three list placeholders.
 *
 * A section cannot be nested inside another section of the SAME key (the
 * closing tag is matched by backreference), so `{{#product_details}}` cannot
 * both wrap a heading and repeat its own rows. Without a separate scalar key
 * there is no way to hide a list's heading/table when the list is empty, and
 * templates render an empty styled box — the exact class of defect that makes a
 * live listing look broken. These are scalars, so they render their body ONCE.
 *
 * Deliberately not in `LISTING_TEMPLATE_PLACEHOLDERS`: they are control flags,
 * not content, and inserting `{{has_features}}` into a template would print a
 * bare "1". Use them only as `{{#has_features}}…{{/has_features}}`.
 *
 * Empty is `''` (never `'0'`) — `isEmptyValue('0')` is false, so a "0" flag
 * would render the very block it is meant to suppress.
 */
export const LISTING_TEMPLATE_PRESENCE_FLAGS = ['has_features', 'has_details', 'has_images'] as const;

/** Truthy value for a presence flag. Any non-blank string works; this is the canonical one. */
const PRESENCE_FLAG_SET = '1';
const PRESENCE_FLAG_UNSET = '';

/**
 * Build the canonical placeholder context from product-shaped data.
 * `product_details` is a "Key: Value" list built from specs — the shape the
 * seeded templates iterate over.
 */
export function buildListingTemplateContext(input: ListingTemplateInput): ListingTemplateContext {
  const images = (input.imageUrls ?? []).filter((url) => typeof url === 'string' && url.length > 0);
  const features = (input.features ?? []).filter((f) => typeof f === 'string' && f.trim().length > 0);
  const productDetails = Object.entries(input.specs ?? {})
    .filter(([key, value]) => Boolean(key) && typeof value === 'string' && value.trim().length > 0)
    .map(([key, value]) => `${key}: ${value}`);

  return {
    title: input.title ?? '',
    product_description: input.description ?? '',
    feature_bullets: features,
    product_details: productDetails,
    main_image: images[0] ?? '',
    images,
    brand: input.brand ?? '',
    manufacturer: input.manufacturer ?? input.brand ?? '',
    asin: input.asin ?? '',
    category: input.category ?? '',
    condition: input.condition ?? '',
    price: typeof input.price === 'number' ? input.price.toFixed(2) : '',
    currency: input.currency ?? '',
    quantity: typeof input.quantity === 'number' ? String(input.quantity) : '',
    has_features: features.length > 0 ? PRESENCE_FLAG_SET : PRESENCE_FLAG_UNSET,
    has_details: productDetails.length > 0 ? PRESENCE_FLAG_SET : PRESENCE_FLAG_UNSET,
    has_images: images.length > 0 ? PRESENCE_FLAG_SET : PRESENCE_FLAG_UNSET,
  };
}

/** Resolve a placeholder key through the alias table. */
function resolve(context: ListingTemplateContext, key: string): ListingTemplateValue {
  if (key in context) {
    return context[key];
  }
  const alias = PLACEHOLDER_ALIASES[key];
  return alias ? context[alias] : undefined;
}

/** Render `{{.}}` (and `{{{.}}}`) inside a section body for one item. */
function renderSectionItem(body: string, item: string): string {
  return body
    .replace(/\{\{\{\s*\.\s*\}\}\}/g, item)
    .replace(/\{\{\s*\.\s*\}\}/g, escapeHtmlText(item));
}

/**
 * Expand `{{#key}}…{{/key}}` / `{{^key}}…{{/key}}` sections.
 * Nested sections of the SAME key are not supported (no template needs them);
 * different keys nest correctly because expansion is innermost-first.
 */
function renderSections(template: string, context: ListingTemplateContext): string {
  // Innermost-first: a section body that contains no other section opener.
  const sectionPattern = /\{\{([#^])\s*([\w.]+)\s*\}\}((?:(?!\{\{[#^])[\s\S])*?)\{\{\/\s*\2\s*\}\}/;

  let output = template;
  let guard = 0;
  while (guard < 100) {
    const match = sectionPattern.exec(output);
    if (!match) {
      break;
    }
    guard += 1;

    const [full, kind, key, body] = match;
    const value = resolve(context, key);
    const empty = isEmptyValue(value);
    let replacement = '';

    if (kind === '^') {
      replacement = empty ? body : '';
    } else if (!empty) {
      replacement = Array.isArray(value)
        ? value.map((item) => renderSectionItem(body, String(item))).join('\n')
        : renderSectionItem(body, toDisplayString(value));
    }

    output = output.slice(0, match.index) + replacement + output.slice(match.index + full.length);
  }

  return output;
}

/** Replace `{{{key}}}` (raw) and `{{key}}` (escaped, arrays → <ul>) tokens. */
function renderVariables(template: string, context: ListingTemplateContext): string {
  let output = template;

  const keys = new Set<string>([...Object.keys(context), ...Object.keys(PLACEHOLDER_ALIASES)]);
  for (const key of keys) {
    const value = resolve(context, key);
    if (value === undefined) {
      continue;
    }
    const escapedKey = escapeRegExp(key);

    // Triple brace: raw (already-sanitized) HTML.
    output = output.replace(
      new RegExp(`\\{\\{\\{\\s*${escapedKey}\\s*\\}\\}\\}`, 'g'),
      () => (Array.isArray(value) ? value.join('\n') : toDisplayString(value))
    );

    // Double brace: escaped text; arrays render as a list (legacy `{{features}}`).
    output = output.replace(new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g'), () => {
      if (Array.isArray(value)) {
        return value.length > 0
          ? `<ul>${value.map((item) => `<li>${escapeHtmlText(String(item))}</li>`).join('')}</ul>`
          : '';
      }
      return escapeHtmlText(toDisplayString(value));
    });
  }

  return output;
}

/**
 * Remove any template syntax the context could not resolve.
 * Without this a typo'd or unsupported placeholder is published verbatim onto
 * the live eBay listing — the exact failure this module exists to prevent.
 */
export function stripUnresolvedPlaceholders(html: string): string {
  return html
    .replace(/\{\{[#^]\s*[\w.]+\s*\}\}[\s\S]*?\{\{\/\s*[\w.]+\s*\}\}/g, '')
    .replace(/\{\{\/\s*[\w.]+\s*\}\}/g, '')
    .replace(/\{\{\{[^{}]*\}\}\}/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '');
}

/**
 * Render a listing description template against a context.
 * Always returns placeholder-free HTML.
 */
export function renderListingTemplate(template: string, context: ListingTemplateContext): string {
  if (!template || template.trim().length === 0) {
    return '';
  }
  const withSections = renderSections(template, context);
  const withVariables = renderVariables(withSections, context);
  return stripUnresolvedPlaceholders(withVariables).trim();
}
