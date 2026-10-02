-- apps/api/migrations/135_buyer_message_defaults_v2.sql
-- Buyer auto-messages, second wording (operator request, 2026-10-02):
--   * the greeting uses the buyer's NAME ({{buyer_name}}), not the eBay
--     username — "Hi sadsd_42" read as spam;
--   * the shipped message carries the tracking number and carrier. The
--     processor resolves {{tracking_number}} to the number eBay received
--     (orders.ebay_tracking_pushed_number), never the supplier's own.
-- eBay member messages are plain text, so the bodies carry no markup.

CREATE TEMP TABLE buyer_message_defaults_v2 (
  event_type buyer_message_event_type PRIMARY KEY,
  body       TEXT NOT NULL
);

INSERT INTO buyer_message_defaults_v2 (event_type, body) VALUES
  ('order_received', $t1$Hi {{buyer_name}},

Thank you for your order of "{{item_title}}"! We're getting it ready for shipment now. We'll send you another update as soon as it ships, including your tracking information.

Thank you for shopping with us!$t1$),
  ('shipped', $t2$Hi {{buyer_name}},

Good news — your "{{item_title}}" is on its way! 📦

Tracking number: {{tracking_number}}
Carrier: {{carrier}}

You can use the tracking number above to follow your package. We'll keep you updated if there are any important changes to your delivery.

Thanks again for your order!$t2$),
  ('delivered', $t3$Hi {{buyer_name}},

Your "{{item_title}}" has been delivered. 📦

We hope everything arrived safely and that you're happy with your purchase. If there's anything we can help you with, please don't hesitate to reach out.

Thank you for choosing us!$t3$),
  ('feedback_request', $t4$Hi {{buyer_name}},

Just checking in to make sure everything went well with your "{{item_title}}".

If you're happy with your purchase, we'd really appreciate it if you could take a moment to leave us some feedback. Your feedback helps us continue providing great service.

Thank you for your support!$t4$);

-- 1. A seller's starter template that still holds the OLD default wording
--    moves to the new one. Runs BEFORE step 2, while the old body is still
--    what buyer_message_system_defaults holds. An edited template is the
--    seller's own text and keeps it ("Reset to default" brings the new body).
UPDATE buyer_message_templates t
   SET body = v.body, updated_at = NOW()
  FROM buyer_message_system_defaults d
  JOIN buyer_message_defaults_v2 v ON v.event_type = d.event_type
 WHERE t.is_default
   AND t.event_type = d.event_type
   AND t.body = d.body;

-- 2. The source copy that new users are seeded from and "Reset" restores.
INSERT INTO buyer_message_system_defaults (event_type, body, updated_at)
SELECT event_type, body, NOW() FROM buyer_message_defaults_v2
ON CONFLICT (event_type) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW();

-- 3. Every other template that greets by username greets by name from now on.
UPDATE buyer_message_templates
   SET body = REPLACE(body, '{{buyer_username}}', '{{buyer_name}}'), updated_at = NOW()
 WHERE body LIKE '%{{buyer_username}}%';

DROP TABLE buyer_message_defaults_v2;
