-- apps/api/migrations/139_template_padding_and_no_brand_row.sql
-- Two template fixes (operator request, 2026-10-03):
--
-- 1. General Store gave its body no horizontal inset. The header carries its
--    own padding, but `.sh-gs-main` (image + overview + key benefits),
--    `.sh-gs-details` (specifications) and the footer sat flush against the
--    container edge — text touching the frame in the settings-drawer preview
--    and on a narrow eBay page. The inset is added to those three blocks, not to
--    the container, so the header's grey band still spans the full width. The
--    specification rows lose their own horizontal padding so they line up with
--    their heading.
--
-- 2. A description never shows the brand. Every sample product read
--    "Brand: Unbranded" in its specifications table, and a live listing showed
--    the supplier's brand (or eBay's placeholder) there. The renderer now leaves
--    brand rows out of `product_details` (`isBrandDetailRow`, packages/shared);
--    the preview reads `sample_data` straight, so the same rows are removed from
--    the stored samples here. eBay's own item specifics still carry Brand.
--
-- 073 / 122 / 126 / 127 are not edited (an applied migration never re-runs).
-- scripts/build-template-previews.mjs parses the replace() statements below and
-- applies them, and drops brand rows from the samples with the same helper.

UPDATE predefined_templates
SET html_content = replace(html_content, '.sh-gs-main { display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px; }', '.sh-gs-main { display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px; padding: 0 24px; }'),
    updated_at   = NOW()
WHERE slug = 'ds-general-store';

UPDATE predefined_templates
SET html_content = replace(html_content, '.sh-gs-details { margin-bottom: 30px; }', '.sh-gs-details { margin-bottom: 30px; padding: 0 24px; }'),
    updated_at   = NOW()
WHERE slug = 'ds-general-store';

UPDATE predefined_templates
SET html_content = replace(html_content, '.sh-gs-table td { padding: 10px; border-bottom: 1px solid #eee; }', '.sh-gs-table td { padding: 10px 0; border-bottom: 1px solid #eee; }'),
    updated_at   = NOW()
WHERE slug = 'ds-general-store';

UPDATE predefined_templates
SET html_content = replace(html_content, '.sh-gs-footer { display: flex; flex-wrap: wrap; gap: 20px; background: #f8f9fa; padding: 20px; border-radius: 8px; }', '.sh-gs-footer { display: flex; flex-wrap: wrap; gap: 20px; background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 0 24px 24px; }'),
    updated_at   = NOW()
WHERE slug = 'ds-general-store';

UPDATE predefined_templates
SET html_content = replace(html_content, '  .sh-gs-badges { flex-direction: column; align-items: center; }', '  .sh-gs-badges { flex-direction: column; align-items: center; }
  .sh-gs-main, .sh-gs-details { padding: 0 16px; }
  .sh-gs-footer { margin: 0 16px 16px; }'),
    updated_at   = NOW()
WHERE slug = 'ds-general-store';

-- Brand rows out of every sample's specifications. Same key test as
-- `isBrandDetailRow`: the text before the first colon is Brand, Brand Name or
-- Manufacturer (case-insensitive).
WITH cleaned AS (
  SELECT
    t.id,
    COALESCE(
      (SELECT jsonb_agg(row_value ORDER BY ordinality)
         FROM jsonb_array_elements(t.sample_data -> 'product_details') WITH ORDINALITY AS d(row_value, ordinality)
        WHERE NOT (
          jsonb_typeof(row_value) = 'string'
          AND (row_value #>> '{}') ~* '^\s*(brand|brand name|manufacturer)\s*:'
        )),
      '[]'::jsonb
    ) AS details
  FROM predefined_templates t
  WHERE jsonb_typeof(t.sample_data) = 'object'
    AND jsonb_typeof(t.sample_data -> 'product_details') = 'array'
)
UPDATE predefined_templates p
SET sample_data = jsonb_set(
      jsonb_set(p.sample_data, '{product_details}', c.details),
      '{has_details}',
      to_jsonb(CASE WHEN jsonb_array_length(c.details) > 0 THEN '1' ELSE '' END)
    ),
    updated_at = NOW()
FROM cleaned c
WHERE p.id = c.id
  AND c.details IS DISTINCT FROM p.sample_data -> 'product_details';
