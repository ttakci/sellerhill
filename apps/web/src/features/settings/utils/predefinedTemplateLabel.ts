import type { PredefinedTemplateResponse } from '@repo/shared';
import type { TFunction } from 'i18next';

/**
 * Localized display name for a predefined listing template.
 *
 * The catalog rows live in the database (migrations `070`/`071`) and their
 * `name`/`description` are canonical English, so rendering them raw put English
 * template names into the Turkish UI. Translations are keyed on the row's stable
 * `slug`, and `defaultValue` degrades to the DB name rather than a raw key when a
 * catalog migration adds a template before its translations land.
 *
 * Used by BOTH surfaces that show a template name — the settings-drawer picker
 * and the group-card badge — so the two can never disagree. The key is written
 * in explicit `ns:key` form (hence the doubled `listingSettingsGroup`: the
 * namespace, then the JSON's own top-level wrapper key) so it resolves the same
 * from a container whose primary namespace is `translation`.
 */
const NAMESPACE_PREFIX = 'listingSettingsGroup:listingSettingsGroup.predefinedTemplates';

export function predefinedTemplateName(t: TFunction, template: PredefinedTemplateResponse): string {
  return t(`${NAMESPACE_PREFIX}.${template.slug}.name`, {
    defaultValue: template.name,
  });
}
