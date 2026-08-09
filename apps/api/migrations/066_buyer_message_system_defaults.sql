-- apps/api/migrations/066_buyer_message_system_defaults.sql
-- Moves the four "Default" buyer message bodies out of code
-- (packages/shared SYSTEM_BUYER_MESSAGE_TEMPLATES) and into the database, and
-- turns them into real per-user buyer_message_templates rows so they show up,
-- and are editable/deletable/resettable, in the "Manage Message Templates" list.

CREATE TABLE IF NOT EXISTS buyer_message_system_defaults (
  event_type  buyer_message_event_type PRIMARY KEY,
  body        TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO buyer_message_system_defaults (event_type, body) VALUES
  ('order_received', $t1$Hi {{buyer_username}}, thank you for your order of "{{item_title}}"! We're getting it ready and will let you know once it ships.$t1$),
  ('shipped', $t2$Hi {{buyer_username}}, great news — "{{item_title}}" is on its way! 📦 It'll arrive with you soon.$t2$),
  ('delivered', $t3$Hi {{buyer_username}}, your "{{item_title}}" has been delivered. We hope you love it! If you're happy, a quick feedback would mean a lot.$t3$),
  ('feedback_request', $t4$Hi {{buyer_username}}, just checking in — if you're enjoying "{{item_title}}", a moment of feedback really helps our small business. Thank you!$t4$)
ON CONFLICT (event_type) DO NOTHING;

-- Marks a buyer_message_templates row as one of the per-user seeded defaults —
-- drives the "Reset to default" action and a "Default" badge in the UI. Not a
-- protected/undeletable flag: the user can delete or fully rewrite it like any
-- other template.
ALTER TABLE buyer_message_templates
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: give every existing user their starter set of four default
-- templates, one per event, so accounts created before this migration are not
-- left with an empty "Manage Message Templates" list. New users are seeded
-- lazily on first read (BuyerMessageTemplateRepository.ensureSeeded) instead
-- of via a registration hook, matching this codebase's "create on demand"
-- idiom (see resolveProductData in listing-processor.service.ts) rather than
-- adding a new post-register lifecycle hook.
INSERT INTO buyer_message_templates (user_id, event_type, name, body, is_default)
SELECT u.id, d.event_type, INITCAP(REPLACE(d.event_type::text, '_', ' ')), d.body, TRUE
FROM users u
CROSS JOIN buyer_message_system_defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM buyer_message_templates t
  WHERE t.user_id = u.id AND t.event_type = d.event_type
)
ON CONFLICT (user_id, name) DO NOTHING;
