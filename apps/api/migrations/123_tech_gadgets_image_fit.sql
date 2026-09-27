-- apps/api/migrations/123_tech_gadgets_image_fit.sql
-- The Tech Gadgets template capped its product image at a fixed 500px
-- (`.sh-tg-image img { max-width: 500px; }`), overriding the template's own
-- `max-width: 100%`. Its mobile fallback is a viewport @media query, so in any
-- container narrower than ~540px that is not the viewport — the settings-drawer
-- preview above all — the image overflowed and was cut off on the right.
-- `min(100%, 500px)` keeps the 500px cap on wide pages and fits narrow ones.
--
-- 073 is not edited (an applied migration never re-runs).
-- scripts/build-template-previews.mjs parses the replace() below and applies it
-- to 073's HTML, so the landing gallery and the demo render the same markup.

UPDATE predefined_templates
SET html_content = replace(html_content, '.sh-tg-image img { max-width: 500px; }', '.sh-tg-image img { max-width: min(100%, 500px); }'),
    updated_at   = NOW()
WHERE slug = 'ds-tech-gadgets';
