# eBay reference documents (local copies)

Official eBay documents fetched on **2026-09-29** and stored here so that decisions about
eBay can be made from the primary source without re-fetching. **Read these first.** Re-fetch
only to refresh a copy, and update the date and the table below when you do.

Why this folder exists: developer.ebay.com serves many pages behind an edge that returns
`403 "Something went wrong on our end"` to non-browser clients, and several doc pages are
JavaScript shells whose content never arrives without a browser session. The set below is
what could be obtained as real content; the "not obtainable" list is what could not.

## Files

| File | Source | Fetched as | Notes |
|---|---|---|---|
| `buy-browse-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/buy/browse/openapi/3/buy_browse_v1_oas3.json` | 200, raw | **Browse API v1.20.4 OpenAPI.** The authoritative method/field reference: `item_summary/search` params (`filter`, `limit` max 200, `offset` max 9,999, 10,000-result cap), `getItems` (`item_ids` max 20), `EstimatedAvailability` (`estimatedSoldQuantity`, `estimatedAvailableQuantity`), `Seller` (username → immutable id note), auth (client-credentials application token; scopes `api_scope`, `buy.item.bulk`). |
| `buy-browse-field-filters.txt` | `https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html` | 200, text-extracted | Every `filter=` value (`sellers:{a|b}`, `excludeSellers`, `price`, `buyingOptions`, `itemLocationCountry`, …). |
| `buy-browse-overview.txt` | `https://developer.ebay.com/api-docs/buy/static/api-browse.html` | 200, text-extracted | Browse API landing/overview (headers, affiliate, legacy item-id bridge). |
| `developer-analytics-v1_beta-oas3.json` | `https://developer.ebay.com/api-docs/master/developer/analytics/openapi/3/developer_analytics_v1_beta_oas3.json` | 200, raw | Analytics API (`getRateLimits` / `getUserRateLimits`), the call the repo already uses for the eBay Limits tab and `ebay:limits-probe`. |
| `application-growth-check.txt` | `https://developer.ebay.com/develop/grow/application-growth-check` | 200, text-extracted | "Requesting an Application Growth Check is required if you want to: Increase the API call limits for your application; Use restricted APIs in production." |
| `data-handling-compliance.txt` | `https://developer.ebay.com/api-docs/static/data-handling-update.html` | 200, text-extracted | Username → immutable user ID replacement for U.S. users (effective 2025-09-26). |
| `api-license-agreement.txt` / `.html` | `https://developer.ebay.com/join/api-license-agreement/` | 200, text + raw HTML | **eBay API License Agreement.** See "Clauses that matter" below. |
| `user-agreement.txt` / `.html` | `https://www.ebay.com/help/policies/member-behavior-policies/user-agreement?id=4259` | 200, text + raw HTML | **eBay User Agreement** (the site terms every eBay account is bound by). |
| `www.ebay.com-robots.txt` | `https://www.ebay.com/robots.txt` | 200, raw | `Disallow: /sch/`, `Disallow: /bin/` (purchase-history pages live under `/bin/`), `Disallow: /usr/`-class paths, most `/itm/*` query variants. |

## Not obtainable on 2026-09-29 (do not guess their content)

- **API Call Limits page** (`/develop/get-started/api-call-limits`): 403 from eBay's edge on every variant tried. The number that matters for *this* application comes from eBay itself anyway: run `pnpm --filter api ebay:limits-probe -- --api-name browse` (or any `api_name`) against the production keyset. The public sign-in page states "New accounts include a free access tier … 5,000 API calls per day".
- **Marketplace Insights API docs** (`/api-docs/buy/marketplace-insights/...`): every URL returned a 200 sign-in/navigation shell with no article body. Whether it is one of the License Agreement's "Restricted APIs" is therefore unread here; the Agreement's own definition ("APIs that provide information about market trends, pricing strategies, sales volumes…") is in `api-license-agreement.txt`.
- **Browse API method HTML pages** (`/api-docs/buy/browse/resources/...`): 403. Their content is the OpenAPI JSON above; nothing is lost.

## Clauses that matter (verbatim, from the local copies)

### API License Agreement → RESTRICTED ACTIVITIES

> "Notwithstanding any rights expressly granted under this API License Agreement, you may not use or access (nor facilitate or enable others to use or access) eBay Services, including the Developer Tools, in any way which may, directly or indirectly, undermine eBay's business interests without eBay's prior written consent. For example, you will not, and you will not facilitate or enable others to do, any of the following:"
>
> - "Use eBay Content, either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Site."
> - "Use eBay Services to promote or engage in seller arbitrage (for example, automatically repricing eBay listings in response to price changes on other third-party sites, automatically ordering sold items from other third-party sites, or posting tracking information to eBay when items purchased from other third-party sites are shipped)."
> - "Use eBay Content to determine or verify eBay User identities or to access user profiles."
> - "Knowingly and/or intentionally design or create an Application that may be used (by you or anyone else) to violate, or attempt to violate, this API License Agreement the eBay User Agreement, …"
> - "Use any API in a manner that exceeds reasonable request volume, constitutes excessive or abusive usage …"

### API License Agreement → data that needs express prior written permission

> "Notwithstanding Your Users' access to and use of their own information, you must have eBay's express prior written permission to use or display eBay Content in any way that enables derivation of, including without limitation, any of the following: Aggregated seller or buyer data …; Data relating to the performance of sellers, either individually or in aggregate …; Information relating to specific eBay Users or types of eBay Users; Conversion, completion or success rates; …"

### API License Agreement → Restricted APIs

> "'Restricted APIs' refers to any eBay APIs that provide information about market trends, pricing strategies, sales volumes, user behavior, or provide generated content … Access is specially granted to select Developers."
>
> "With respect to Restricted APIs, Developer may not: … Sell, share, assign, or otherwise transfer … the information from Restricted APIs to any third party who is not a mutual customer of you and eBay (for example, an eBay seller); Electronically distribute via API the Restricted APIs data … or allow the Restricted APIs data … to be downloaded in bulk."
>
> "Developer is permitted to … distribute data outputs of the Restricted APIs Data during the Term to develop pricing tools, only upon receiving eBay's express prior written consent."

### User Agreement → 3. Using eBay

> "you will not: … use any robot, spider, scraper, data mining tools, data gathering and extraction tools, or other automated means (including, without limitation buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review) to access our Services for any purpose, except with the prior express permission of eBay;"
>
> "… harvest or otherwise collect or use information about users without their consent."

### Browse API facts (OpenAPI v1.20.4)

- `item_summary/search` accepts `filter=sellers:{rpseller|bigSal}` (other sellers' *active* listings are readable with an application token). `limit` max 200, `offset` max 9,999, "This method can return a maximum of 10,000 items in one results set."
- `getItem` / `getItems` return `estimatedAvailabilities[].estimatedSoldQuantity` ("The estimated number of this item that have been sold."). `getItems` takes at most 20 `item_ids` per call.
- `Seller.username`: "Effective September 26, 2025, select developers will no longer receive username data for U.S. users through this field. Instead, an immutable user ID will be returned in its place." Whether `sellers:{…}` accepts that id for U.S. sellers is not stated in these documents.
- No "sold items in the last N days" method exists in the Browse API; sold volume can only be inferred by sampling `estimatedSoldQuantity` over time.
