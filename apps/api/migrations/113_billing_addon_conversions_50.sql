-- A fourth tracking-conversion top-up: 50 for $9.99 (operator decision, 2026-09-19).
--
-- The smallest pack was 100 for $19.99, which is the price of the whole Lite
-- plan (25 conversions a month). A seller on that tier who runs out needs a
-- handful more, not four times their allowance, and a pack that costs as much
-- as their subscription reads as a penalty rather than a top-up.
--
-- $0.20 per conversion, the same unit price as the 100 pack, so the ladder is
-- 0.20 / 0.20 / 0.18 / 0.16 and never asks a smaller buyer to pay more per unit
-- than a larger one. The other three packs are unchanged.
--
-- Same rules as 087: this is an ordinary row, mirrored to Stripe as a one-time
-- price by the hourly catalog sync (no command), offered only to a seller who
-- has actually reached their conversion limit, and raising the CURRENT month's
-- ceiling only. `display_order` 5 puts it first in the picker.

INSERT INTO billing_quota_addons (slug, limit_key, quantity, amount_micros, display_order)
VALUES
    ('conversions-50', 'tracking_conversions_per_month', 50, 9990000, 5)
ON CONFLICT (slug) DO UPDATE SET
    limit_key = EXCLUDED.limit_key,
    quantity = EXCLUDED.quantity,
    amount_micros = EXCLUDED.amount_micros,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();
