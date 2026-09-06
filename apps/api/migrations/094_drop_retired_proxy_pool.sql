-- Migration 094: drop the retired platform proxy pool.
--
-- WHY
-- ---
-- `proxies` (migrations 057/058) held the operator-provisioned pool of fixed ISP
-- proxies, one assigned per user. That model was retired 2026-08-13 when Amazon
-- browser-automation proxying became self-service and per-`amazon_accounts` row
-- (migration 080 — `proxy_enabled` / `proxy_host` / ... on the account itself,
-- read by `BrowserStateManager.resolveProxy`). The pool's code — `ProxyService`,
-- `AdminProxiesService`, `POST`/`PATCH /admin/proxies*`, `proxy-pool.helpers.ts`,
-- the `ProxyStatus` enum and every `AdminProxy*` DTO — was deleted then. The
-- `proxies` table has had zero readers/writers since (verified by grep: no
-- SELECT/INSERT/UPDATE/JOIN anywhere in apps/ or packages/, no inbound FK).
--
-- It is unrelated to the live per-account proxy columns on `amazon_accounts`,
-- which are NOT touched here.
--
-- IF EXISTS so a fresh replay that somehow lacks 057/058 still passes.

DROP TABLE IF EXISTS proxies CASCADE;
