# Daily summary e-mail — design (2026-10-08)

Operator decisions, taken in conversation on 2026-10-07/08.

## What

ONE e-mail per seller account per day: the previous day of the seller's OWN calendar
(`users.timezone`, migration `149`), sent at a seller-chosen local hour. No per-event
mails. The billing e-mails (payment failed, trial ending, price change) are unchanged and
stay outside it.

## Decisions

| Question | Decision |
|---|---|
| Which "day" | The seller's calendar day in `users.timezone` (NULL → UTC). The dashboard uses the same day (panel session, commits `b5911530`…`82268c56`). |
| When | Default 08:00 local, choosable 05:00–12:00 on the hour. It always reports the previous FULL local day: at midnight the day's last orders and Amazon costs (3-hourly cost capture) are not in yet. |
| One or per store | One per ACCOUNT: an all-stores total, then one row per store (hidden when the account has a single store). No per-store opt-out (YAGNI). |
| Default | ON for everybody, existing users included. A link in every mail goes to the setting. |
| Empty day | No orders, no cancellations, no new cancel requests / returns and nothing waiting → no mail (the day is still stamped). |
| Recipient | The account e-mail only. Extra recipients would mean mailing unverified addresses. |
| Language | `en` / `tr` templates; every other locale gets English (existing `EmailService` rule). Dynamic row labels use the SAME language as the template that is actually sent. |
| Suspended account | No mail (stamped). |

## Content and where each figure comes from

| Line | Source |
|---|---|
| Orders, sales, net profit (confirmed), estimated profit, orders of that day since cancelled | `DashboardService.getRangeMetricsByStore(user, {d, d}, tz)` — the card fragment, so a store row equals the dashboard for that store |
| New cancel requests | `ebay_cancellations`, `requestor_type = 'BUYER'`, `requested_at` inside the local day |
| New returns | `ebay_returns.created_on_ebay_at` inside the local day |
| Waiting on the seller | `ActionCenterService.getSummary(user, null)` items with severity critical or warning — the list the sidebar badge counts; titles reuse `actionCenter.items.<key>.title` |

Untracked orders are outside every figure, as on the dashboard.

## Mechanism

- `users.digest_enabled` (default TRUE), `users.digest_send_hour` (5–12, default 8),
  `users.digest_last_sent_for DATE` (migration `150`).
- Queue `seller-digest`, hourly tick at :07. One statement selects due users
  (`local hour >= send hour` and `digest_last_sent_for < local yesterday`), stamps
  `digest_last_sent_for = local yesterday` and returns them (`FOR UPDATE SKIP LOCKED`,
  batches of 200), then one `send` job per user (`jobId digest-<user>-<date>`).
- A failed send does NOT un-stamp: a lost mail beats a duplicate one. A missed tick is
  caught by the next hour.
- Platform kill switch `notifications.digest.enabled` (default true).
- `EmailService.replaceVariables` now inserts values with a function replacer, so a `$&`
  or `$1` inside a store name can no longer be expanded by `String.replace`.

## Settings UI

Settings hub → new "Notifications" card → `NotificationsDrawer` (toggle + hour select, and
a line naming the time zone the hour is read in; the zone itself is edited in the profile
drawer). Saved through the existing `PUT /profile`.
