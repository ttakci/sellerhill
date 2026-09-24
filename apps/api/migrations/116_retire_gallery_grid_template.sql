-- Retire the one catalog template built around the multi-image loop.
--
-- `images` and `has_images` left the template vocabulary on 2026-09-24: the
-- description now renders exactly one image, served from our own domain rather
-- than hot-linked from Amazon, so a buyer reading the listing source cannot
-- identify the supplier. `gallery-grid` is built entirely around
-- `{{#has_images}}<div>{{#images}}...{{/images}}</div>{{/has_images}}`, which
-- would now render a styled wrapper over nothing.
--
-- Soft-retired, never deleted. `listing_settings_groups.templates` stores the
-- chosen template id inside JSONB with no foreign key, so a DELETE would
-- silently degrade every group already pointing at it to the default template
-- while the UI kept showing the chosen name. `is_active = FALSE` hides it from
-- the picker while `getPredefinedTemplateHtml` can still resolve it, so groups
-- already on it keep rendering (now with the image block stripped).

UPDATE predefined_templates
   SET is_active = FALSE
 WHERE slug = 'gallery-grid';
