-- Expand blacklist scope into independently selectable eBay payload field types.
-- Amazon is seeded once for existing rows; users may remove it afterwards.

ALTER TABLE store_settings
  ALTER COLUMN blacklist SET DEFAULT
  '[{"keyword":"Amazon","types":["title","description","feature_specification","brand_manufacturer"]}]'::jsonb;

WITH normalized AS (
  SELECT
    id,
    COALESCE(
      jsonb_agg(
        CASE
          WHEN entry ? 'types' THEN entry
          WHEN entry->>'scope' = 'title' THEN
            (entry - 'scope') || '{"types":["title"]}'::jsonb
          WHEN entry->>'scope' = 'description' THEN
            (entry - 'scope') || '{"types":["description"]}'::jsonb
          WHEN entry->>'scope' = 'both' THEN
            (entry - 'scope') || '{"types":["title","description"]}'::jsonb
          ELSE entry - 'scope'
        END
      ) FILTER (WHERE jsonb_typeof(entry) = 'object'),
      '[]'::jsonb
    ) AS entries
  FROM store_settings
  LEFT JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(blacklist) = 'array' THEN blacklist ELSE '[]'::jsonb END
  ) AS entry ON TRUE
  GROUP BY id
), with_default AS (
  SELECT
    id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_array_elements(entries) AS item
        WHERE LOWER(item->>'keyword') = 'amazon'
      ) THEN (
        SELECT jsonb_agg(
          CASE
            WHEN LOWER(item->>'keyword') = 'amazon' THEN
              (item - 'types') || '{"types":["title","description","feature_specification","brand_manufacturer"]}'::jsonb
            ELSE item
          END
        )
        FROM jsonb_array_elements(entries) AS item
      )
      ELSE entries || '[{"keyword":"Amazon","types":["title","description","feature_specification","brand_manufacturer"]}]'::jsonb
    END AS entries
  FROM normalized
)
UPDATE store_settings AS settings
SET blacklist = with_default.entries
FROM with_default
WHERE settings.id = with_default.id;
