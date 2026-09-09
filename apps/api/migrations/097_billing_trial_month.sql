-- Migration 097: the trial becomes a 30-day, 20-conversion offer.
--
-- Listings stay at 50 and the AO ceiling stays at 20. Migration 085 set AO to
-- 2x the conversion quota; here they are deliberately equal, so the conversion
-- quota can never be the binding limit within a trial. That is intended — the
-- trial's cost ceiling is the 20 conversions (~$2.80 of Aquiline) either way,
-- and a trial user hitting a quota wall is the opposite of the point.
--
-- Duration is NOT here: it is the `billing.trialDays` platform setting.

UPDATE billing_plan_limits
   SET limit_value = 20, updated_at = NOW()
 WHERE limit_key = 'tracking_conversions_per_month'
   AND plan_id = (SELECT id FROM billing_plans WHERE slug = 'trial');

UPDATE billing_plans
   SET description = 'Automatic 30-day cardless trial for newly registered users.',
       updated_at = NOW()
 WHERE slug = 'trial';
