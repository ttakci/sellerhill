# eBay reference documents (local copies)

Official eBay documents fetched on **2026-09-29** (order, return and notification documents on **2026-09-30**) and stored here so that decisions about
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
| `sell-fulfillment-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/sell/fulfillment/openapi/3/sell_fulfillment_v1_oas3.json` | 200, raw (2026-09-30) | **Fulfillment API v1.20.7 OpenAPI.** `getOrders` / `getOrder` / `issueRefund` / `createShippingFulfillment` / payment disputes, with each method's OAuth scopes. Enum VALUES are not in the file (see "Not obtainable"). |
| `commerce-notification-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/commerce/notification/openapi/3/commerce_notification_v1_oas3.json` | 200, raw (2026-09-30) | **Notification API v1.6.7 OpenAPI** (destination, subscription, topic, public key). |
| `sell-finances-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/sell/finances/openapi/3/sell_finances_v1_oas3.json` | 200, raw (2026-09-30) | **Finances API v1.19.0 OpenAPI** (payouts, transactions, billing activity). Used since 2026-10-04 by the capture-only billing sweep (`GET /billing_activity`, host `api.ebay.com` — the OpenAPI overrides `servers` for this path; the other Finances paths are on `apiz.ebay.com`, where `billing_activity` answers 404 (production, 2026-10-04) — scope `sell.finances`); quota resource `payoutapi.sell.finances`, 15,000/day (production `getRateLimits`, 2026-10-04). |
| `notification-topics/<TOPIC>.v1.0.0.asyncapi.yaml` + `<TOPIC>.meta.json` | embedded in `https://developer.ebay.com/api-docs/commerce/notification/overview.html` | 200, extracted (2026-09-30) | **The payload contract of each topic** (AsyncAPI 2.0.0) plus eBay's summary, description and samples: `ORDER_CONFIRMATION`, `ORDER_CANCELLATION_ACTIVITY`, `ORDER_RETURN_ACTIVITY`, `ORDER_INQUIRY_ACTIVITY`, `ITEM_MARKED_SHIPPED`, `NEW_MESSAGE`. The page embeds all 29 topics; re-extract others from it the same way. |
| `notification-topics/getTopic-live-2026-09-30.json` | `GET /commerce/notification/v1/topic/{id}` against the PRODUCTION keyset | 200, eBay's own answer | Per topic: `scope` (USER/APPLICATION), `authorizationScopes`, `supportedPayloads` (schema versions), `filterable`. This — not a doc page — is the authority for which OAuth scope a subscription needs. |
| `post-order/*.txt` | `https://developer.ebay.com/Devzone/post-order/<page>.html` (each file names its own URL on line 1) | 200, text-extracted (2026-09-30) | **Post-Order API v2 reference**: call conventions (`MakingACall`), returns (search / get / decide / issue_refund / mark_as_received / tracking), cancellations (search / get / approve / reject), inquiries (search / get / issue_refund), case search. |
| `post-order/types/*.txt` | `https://developer.ebay.com/Devzone/post-order/types/<Type>.html` | 200, text-extracted (2026-09-30) | The enum VALUE lists the return payloads use: `ReturnStateEnum`, `ReturnStatusEnum`, `ReturnCountFilterEnum`, `ReturnReasonEnum`, `ReturnReasonTypeEnum`, `ReturnTypeEnum`, `ActivityOptionEnum`, `UserRoleFilterEnum`, `ReturnSortField`. |
| `sell-inventory-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/sell/inventory/openapi/3/sell_inventory_v1_oas3.json` | 200, raw (2026-09-30) | **Inventory API v1.18.5 OpenAPI.** `getInventoryItems` (`limit` 1–200, `offset` is a PAGE number), `getOffers` (one SKU per call), `getOffer` → `listing.{listingId, listingStatus, listingOnHold, soldQuantity}`, `bulkMigrateListing` requirements. |
| `sell-analytics-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/sell/analytics/openapi/3/sell_analytics_v1_oas3.json` | 200, raw (2026-09-30) | **Sell Analytics API v1.3.2 OpenAPI.** `getTrafficReport` (scope `sell.analytics.readonly`): dimensions, the 13 metrics, the `filter` grammar and its limits. |
| `sell-feed-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/sell/feed/openapi/3/sell_feed_v1_oas3.json` | 200, raw (2026-09-30) | **Feed API v1.3.1 OpenAPI.** `createInventoryTask` — "Presently, only one feed type is available: LMS_ACTIVE_INVENTORY_REPORT". |
| `trading/GetMyeBaySelling.txt`, `GetItem.txt`, `GetSellerList.txt`, `GetSellerEvents.txt` | `https://developer.ebay.com/devzone/xml/docs/reference/ebay/<Call>.html` | 200, text-extracted (2026-09-30) | **Trading API call reference, version 1477.** Input fields, every output field with its description, the detail-level tables and the per-seller short-duration limits. |
| `sell-marketing-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/sell/marketing/openapi/3/sell_marketing_v1_oas3.json` | 200, raw (2026-10-02) | **Marketing API v1.23.2 OpenAPI.** Promoted Listings campaigns and ads: `createCampaign` (201, id in the `Location` header), `getCampaignByName`, `bulkCreateAdsByListingId` (max 500 listings per call), every error id. Scope `sell.marketing`. |
| `sell-account-v1-oas3.json` | `https://developer.ebay.com/api-docs/master/sell/account/openapi/3/sell_account_v1_oas3.json` | 200, raw (2026-10-02) | **Account API v1 OpenAPI.** `getAdvertisingEligibility` (`program_types` query, `X-EBAY-C-MARKETPLACE-ID` header required). |

## Not obtainable on 2026-09-29 (do not guess their content)

- **API Call Limits page** (`/develop/get-started/api-call-limits`): 403 from eBay's edge on every variant tried. The number that matters for *this* application comes from eBay itself anyway: run `pnpm --filter api ebay:limits-probe -- --api-name browse` (or any `api_name`) against the production keyset. The public sign-in page states "New accounts include a free access tier … 5,000 API calls per day".
- **Marketplace Insights API docs** (`/api-docs/buy/marketplace-insights/...`): every URL returned a 200 sign-in/navigation shell with no article body. Whether it is one of the License Agreement's "Restricted APIs" is therefore unread here; the Agreement's own definition ("APIs that provide information about market trends, pricing strategies, sales volumes…") is in `api-license-agreement.txt`.
- **Browse API method HTML pages** (`/api-docs/buy/browse/resources/...`): 403. Their content is the OpenAPI JSON above; nothing is lost.
- **Fulfillment API enum type pages** (tried 2026-09-30, 403 on every variant): `https://developer.ebay.com/api-docs/sell/fulfillment/types/sel:CancelStateEnum`, `…/types/sel:OrderPaymentStatusEnum`, `…/types/sel:RefundStatusEnum`, `…/types/sel:CancelRequestStateEnum`, `…/types/api:ReasonForRefundEnum`. The OpenAPI file types these fields as plain strings, so the VALUE LISTS are not in this folder. What is known instead is under "Order, cancellation, refund and return facts" below: the documented fields that make the enums unnecessary, and the values observed in real production responses. **`ReasonForRefundEnum` is required input for `issueRefund` — that method must not be implemented until the page is saved here** (open the URL in a browser and save the page into this folder).
- **Fulfillment API method HTML pages** (`/api-docs/sell/fulfillment/resources/...`, `/overview.html`): 403. Their content is the OpenAPI JSON above.

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

### Order, cancellation, refund and return facts (2026-09-30)

Every line is either quoted from a file in this folder or was observed in a real response from the production keyset on 2026-09-30 (marked **observed**). Nothing here is inferred.

**Fulfillment `getOrders`** (`sell-fulfillment-v1-oas3.json`)
- Scopes: `sell.fulfillment` or `sell.fulfillment.readonly`.
- `filter` criteria: `creationdate:[from..to]`, `lastmodifieddate:[from..to]` ("the orders.modifiedDate field"), `orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}` / `{FULFILLED|IN_PROGRESS}`. **"If creationdate and lastmodifieddate are both included, only creationdate is used."** Timestamps are ISO 8601 UTC; `[`, `]`, `{`, `|`, `}` must be percent-encoded.
- Paging is `limit` (default 50, **max 200** — "If a requested limit is more than 200, the call fails") and zero-based `offset`. There is no continuation-token parameter.
- "getOrders can return orders up to two years old."
- `Order.cancelStatus` is "always returned"; with no cancel request `cancelState` is `NONE_REQUESTED` and `cancelRequests` is empty. "For the getOrders call: This array is returned but is always empty. For the getOrder call: This array is returned fully populated." `cancelStatus.cancelledDate`: "The date and time the order was cancelled, if applicable."
- `Order.paymentSummary.refunds[]` "is always returned, but is returned as an empty array unless the seller has submitted a partial or full refund"; each entry has `amount` ("the seller's net amount … eBay-collected tax will not be included"), `refundDate` ("not returned until the refund has been issued"), `refundId`, `refundReferenceId`, `refundStatus`.
- `paymentSummary.totalDueSeller` "is subject to change … if a partial or full refund occurs with the order."
- **Observed 2026-10-01, `getOrder`** (one paid, unshipped production order): `cancelStatus` = `{"cancelState":"NONE_REQUESTED","cancelRequests":[]}`; `lineItems[].lineItemFulfillmentInstructions` carries `minEstimatedDeliveryDate`, `maxEstimatedDeliveryDate`, `shipByDate` and `guaranteedDelivery`. A cancel request that is actually open has still not been observed.
- **Observed 2026-10-01, `getShippingFulfillments`** (`GET /order/{orderId}/shipping_fulfillment`): an order with NO fulfillment answers **HTTP 200** with `{"total":0,"fulfillments":[]}` (not a 404); a shipped order answers `total: 1` and one entry with `fulfillmentId`, `shipmentTrackingNumber` (the number we pushed), `shippingServiceCode`, `shippedDate` and `lineItems[].lineItemId` (the order line item id). `shippingCarrierCode` was NOT present on that entry.
- **Observed** (50 orders of one store): `orderFulfillmentStatus` ∈ {`FULFILLED`, `NOT_STARTED`}; `orderPaymentStatus` ∈ {`PAID`, `FULLY_REFUNDED`}; `cancelStatus.cancelState` ∈ {`NONE_REQUESTED`, `CANCELED`}, and the one `CANCELED` order carried a `cancelledDate`; `refunds[].refundStatus` = `REFUNDED`. A `lastmodifieddate:[<60 days ago>..]` filter answered 200 with 157 orders.

**Fulfillment `issueRefund`** — scope **`sell.finances`** (not one SellerHill requests today). Body: `reasonForRefund` (required, `ReasonForRefundEnum` — values not obtainable, see above), `comment` (max 100), and either `orderLevelRefundAmount` or `refundItems[]`. Processed asynchronously; success returns `refundStatus: PENDING`. "Due to EU & UK Payments regulatory requirements, an additional security verification via Digital Signatures is required" for EU/UK sellers.

**Post-Order API** (`post-order/MakingACall.txt`)
- Base `https://api.ebay.com` (sandbox `https://api.sandbox.ebay.com`). "Each Post-Order API call requires the Authorization and X-EBAY-C-MARKETPLACE-ID HTTP headers"; `Content-Type: application/json`. "The Post Order API accepts both OAuth and Auth'n'Auth tokens … OAuth – Prefix a valid User access token with the string \"IAF \" (with a space)."
- The doc pages name **no OAuth scope**. **Observed**: `GET /post-order/v2/return/search`, `/cancellation/search` and `/inquiry/search` all answered **200** with a user token whose consented scopes are the ones SellerHill already requests (`sell.fulfillment`, `sell.inventory`, `sell.account`, …) — no new consent is needed to READ returns.
- `GET /post-order/v2/return/search`: "This method is not supported in the Sandbox environment." Query: `creation_date_range_from` ("cannot be set to more than 18 months in the past. If you specify a creation_date_range_from value, but do not specify a creation_date_range_to value, the method returns all return requests created at or after the specified timestamp and goes forward for the following 90 days"), `limit` (1–200, default 25), `offset`, `return_state` (`ReturnCountFilterEnum`: `ALL_OPEN`, `CLOSED`, `SELLER_ACTION_DUE`, `SELLER_ACTION_OVERDUE`, …), `order_id`, `return_id`, `item_id` + `transaction_id`.
- Response `members[]` (`ReturnSummaryType`): `returnId`, `orderId`, `state` (`ReturnStateEnum`), `status` (`ReturnStatusEnum`), `currentType` ("Currently, the only supported value is MONEY_BACK"), `creationInfo` { `item` { `itemId`, `transactionId`, `returnQuantity` }, `reason`, `reasonType` (`CANCEL` | `INSTORE` | `REMORSE` | `SNAD` | `UNKNOWN`), `comments.content`, `creationDate.value` }, `sellerTotalRefund` / `buyerTotalRefund` { `estimatedRefundAmount`, `actualRefundAmount` }, `sellerResponseDue` { `activityDue` (`ActivityOptionEnum`), `respondByDate.value` } — "This container indicates the next action the seller is responsible for, and the 'due date' for this action. This container might not be returned if there is currently no action due from the seller." — `escalationInfo.caseId`, `sellerAvailableOptions[]`, plus `paginationOutput` { `offset`, `limit`, `totalPages`, `totalEntries` }.
- `POST /post-order/v2/return/{returnId}/issue_refund`: "not supported in the Sandbox environment"; requires `refundDetail` with `itemizedRefundDetail[]` (`refundAmount`, `refundFeeType`) whose amounts "should equal" `totalAmount`; same EU/UK Digital Signature note.

**Notification topics** (`notification-topics/getTopic-live-2026-09-30.json`; all `scope: USER`, not filterable, JSON over HTTPS)

| Topic | `authorizationScopes` | Schema versions |
|---|---|---|
| `ORDER_CONFIRMATION` | `sell.fulfillment`, `sell.fulfillment.readonly` | 1.0, 1.1 |
| `ORDER_CANCELLATION_ACTIVITY` | `sell.cancellation.read`, `sell.cancellation` | 1.0 |
| `ORDER_RETURN_ACTIVITY` | `sell.return.read`, `sell.return` | 1.0 |
| `ORDER_INQUIRY_ACTIVITY` | `sell.inquiry.read`, `sell.inquiry` | 1.0 |
| `ITEM_MARKED_SHIPPED` | `commerce.shipping` | 1.0 |
| `NEW_MESSAGE` | `commerce.message` | 1.0 |

So a push subscription for cancellations, returns or inquiries needs a scope SellerHill does **not** request today (`sell.cancellation*`, `sell.return*`, `sell.inquiry*`): it would have to be enabled on the keyset first and every seller would have to reconnect. Polling needs neither. `createSubscription` itself needs `commerce.notification.subscription` and a body of `topicId`, `status` (ENABLED/DISABLED), `destinationId`, `payload` { `format`, `schemaVersion`, `deliveryProtocol` }.

**Shared daily quotas that bound these** (production `getRateLimits`, 2026-09-30): `sell.fulfillment` 100,000 · `sell.fulfillment.refund` 100,000 · `post-order.return` 5,000 · `post-order.cancellation` 5,000 · `post-order.inquiry` 5,000 · `post-order.casemanagement` 5,000 · `commerce.notification` 10,000 · `payoutapi.sell.finances` 15,000 · Trading `GetOrders` 5,000.

## Promoted Listings facts (2026-10-02)

Everything `EbayPromotedListingsService` does is taken from `sell-marketing-v1-oas3.json` or from a live answer of the production keyset; nothing is assumed.

- **Quota (live `getRateLimits`, 2026-10-02):** `sell.marketing` **10,000/day**, `sell.marketing.ads.campaign` **100,000/day**, `sell.marketing.promotions` 10,000/day. eBay does not say which method draws from which, so the app governs every Marketing call against the tighter `sell.marketing` figure (`EbayApiResource.MARKETING`).
- **Scope:** `sell.marketing` is already in the consent the app requests; a live `getCampaigns` on the production store answered 200 (`campaigns: []`). No re-consent is needed.
- **Eligibility (live, production store, 2026-10-02):** `GET /sell/account/v1/advertising_eligibility` answered `PROMOTED_LISTINGS_STANDARD` → `status: INELIGIBLE`, `reason: NOT_ENOUGH_ACTIVITY` (the same for `OFFSITE_ADS` and `PROMOTED_LISTINGS_ADVANCED`). `INELIGIBLE` is the only status value observed; the app treats exactly that value as "do not send" and leaves every other answer for eBay to judge.
- **`bidPercentage`** (the ad rate): a string, "a single precision value" (4.1, 5.0, 5.5 valid; 0.01, 10.75, 99.99 not), "a minimum value of 2.0 and a maximum value of 100.0". Charged only "when an item sells through a Promoted Listings ad campaign".
- **`createCampaign`:** `campaignName` unique per seller, max 80 characters; `startDate` in `yyyy-MM-ddThh:mm:ssZ` and not in the past (35026); `fundingStrategy.fundingModel` — the OAS names `COST_PER_SALE` as the Promoted Listings default; `marketplaceId` required (35041). Refusals that are about the SELLER, not the request: 35067 (terms not accepted), 35077 (seller level), 35078 ("must be in good standing with recent sales activity"). 35021 = the name already exists.
- **`bulkCreateAdsByListingId`:** `{ requests: [{ listingId, bidPercentage }] }`, "a maximum of 500 listings per call", a campaign holds at most 50,000 items; answers 200 or 207 with `responses[]` (`listingId`, `statusCode`, `adId` only when created). 35036 = an ad for the listing already exists; 35035 / 35045 = the campaign ended / does not exist.
- **Not obtainable:** the enum pages `pls:FundingModelEnum`, `pls:FundingModelTypeEnum` and `pls:CampaignStatusEnum` answered 403 from eBay's edge; the Account enum pages return a script shell with no values in it. The eligibility values above are therefore the live answer, not a documented list.
- **Not exercised live:** `createCampaign` and `bulkCreateAdsByListingId` have never been called — the only production store is ineligible, and both are writes to a real seller's account.
- **Which pool moves (measured 2026-10-03, `getRateLimits` before/after real GETs with the eligible second store's token):** `getCampaigns` / `getAds` count against `sell.marketing.ads.campaign` (100,000/day); `sell.marketing` (10,000/day) did not move. Report calls are listed under the per-USER `sell.marketing.ad_report`, not the shared pool.
- **`GET /ad_campaign/{id}/ad`:** `limit` max 500; **`listing_ids` takes 500 ids in one call** (tested at 50/200/500); each ad carries its own `bidPercentage`. `GET /ad_campaign` carries `fundingStrategy { fundingModel, adRateStrategy, bidPercentage }` (`FIXED` observed) and `campaignCriterion` on a rule-based campaign. Two general campaigns of one store shared none of 500 listings checked.
- **Report metadata (live, 2026-10-04):** `GET /ad_report_metadata/CAMPAIGN_PERFORMANCE_REPORT` → [`marketing/ad-report-metadata-campaign-performance.json`](marketing/ad-report-metadata-campaign-performance.json). Dimensions `day`, `campaign_id` (annotations `campaign_name`, `campaign_status`, start/end dates, budget), `listing_id` (annotations incl. `ad_rate`, `listing_price`, `listing_quantity_sold`), `ad_group_id`, `inventory_reference_id/type`; at most 6 dimensions and 56 metrics per request. General (cost-per-sale) metrics: `impressions`, `clicks`, `ad_fees`, `sales` (count), `sale_amount`, `ctr`, `avg_cost_per_sale`; every `cpc_*` / `*video*` / `*static*` metric belongs to Priority campaigns. The report FILE format is still uncaptured.

## Listing, traffic, watch-count and sold-quantity facts (2026-09-30)

What eBay lets a seller application read about its own listings, from the local copies above plus
read-only calls against the production keyset. Quotas are eBay's own `getRateLimits` answer
for THIS application (stored hourly in `ebay_rate_limits`), not a doc page.

### Limits that decide everything (application-wide, per day)

| Resource | Limit | Source |
|---|---:|---|
| `sell.inventory` | 2,000,000 | `getRateLimits` |
| `sell.feed` | 100,000 | `getRateLimits` |
| Trading `GetMyeBaySelling`, `GetItem`, `GetSellerList`, `GetSellerEvents` | 5,000 each | `getRateLimits` |
| `sell.analytics.traffic_report` | **100** | `getRateLimits` |
| `buy.browse` | 5,000 | `getRateLimits` |
| `commerce.notification` | 10,000 | `getRateLimits` |

`getUserRateLimits` (called with a seller's token) lists only Trading write calls, `commerce.catalog`,
`commerce.identity.user`, `commerce.media.document` and `sell.marketing.ad_report` — so none of the read
limits above is per seller; they are shared by every seller of the application.

### Views and impressions — `getTrafficReport` (works with the scope stores already grant)

- Verified live: `dimension=LISTING`, metrics `LISTING_IMPRESSION_TOTAL, LISTING_VIEWS_TOTAL, CLICK_THROUGH_RATE, TRANSACTION, SALES_CONVERSION_RATE`, 30-day range → 200 records, one per listing id.
- "If you specify dimension=LISTING without specifying any listing_ids in the parameter filter, the traffic report returned in the response contains a maximum of 200 listings." "You can specify to 200 different listingId values."
- "The maximum range between the start and end dates is 90 days, and the earliest start date you can specify is two years prior to the current date."
- "This filter only returns data for listings that have been either active or sold in last 90 days, and any unsold listings in the last 30 days."
- `marketplace_ids`: "currently the filter allows only a single marketplace ID".
- Sorting: "Sorting on the SALES_CONVERSION_RATE metric is not supported"; `TRANSACTION` only descending.
- **100 calls a day for the whole application × 200 listings = at most 20,000 listing rows a day, for all sellers together.**

### Watchers — Trading only

- `Item.WatchCount`: "The number of watches placed on this item from buyers' My eBay accounts. Specify IncludeWatchCount as true in the request. Returned by GetMyeBaySelling only if greater than 0."
- `GetMyeBaySelling` ActiveList returns `ItemID`, `SKU`, `Title`, `QuantityAvailable`, `SellingStatus.QuantitySold` and `WatchCount`, 200 entries a page at most. "GetMyeBaySelling has a limit of 25,000 items." "Per (seller) user ID, no more than 300 GetMyeBaySelling calls can be executed within any 15-second interval."
- `GetSellerList` and `GetSellerEvents` take `IncludeWatchCount`; `GetSellerList` needs a start- or end-time range "less than 120 days" and 200 entries a page at most.
- Browse `watchCount`: "This field is restricted to applications that have been granted permission to access this feature. You must submit an App Check ticket to request this access."
- The Inventory API, the Feed report and the traffic report carry no watch count.

### Hit counter — do not build on it

- `GetItem` change history: "Item.HitCount (deprecated): Hit counters are no longer shown in View Item pages, so this field is no longer applicable."
- `GetSellerList`: "This value indicates the number of page views that a listing has received in the last 30 days. We recommend that you use the getTrafficReport method of the Analytics API to return user traffic details received by a seller's listings."

### Sold quantity

- Inventory `getOffer` → `listing.soldQuantity`: "the quantity of the product that has been sold for the published offer" (one call per offer).
- Trading `SellingStatus.QuantitySold`: "The total number of items purchased so far (in the listing's lifetime)."
- Traffic report `TRANSACTION`: the transaction count inside the requested date range.
- Browse `estimatedSoldQuantity`: "The estimated number of this item that have been sold."

### Listing the catalogue, and hearing about changes

- Feed `LMS_ACTIVE_INVENTORY_REPORT`: "a report that contains price and quantity information for all of the active listings for a specific seller" — every active listing whatever created it, but only ItemID, SKU, price and quantity (no title, no counts).
- Inventory `getInventoryItems`: "retrieves all inventory item records defined for the seller's account" — Inventory-model records only. Live: needs an `Accept-Language` header (400 without it); the production store holds 368 records.
- `GetSellerEvents`: "a list of the items on which a seller event has occurred" by modification, start or end time; "the time range you use should be less than 48 hours. If 3000 or more items are found, use a smaller time range."; "no more than 1000 GetSellerEvents calls … within any 15-second interval" per seller.
- Notification topic `LISTING` (live `getTopic`): "notifies you of any listing events including creation, updates, and termination … whenever a listing transitions state or when specific data fields (such as price or quantity) are modified." USER scope, **authorizationScopes `sell.listing.read` / `sell.listing`** — scopes no connected store has granted. `ITEM_AVAILABILITY`, `ITEM_PRICE_REVISION` and `PRIORITY_LISTING_REVISION` need `buy.item.stream` and are described as eBay Partner Network topics; `WATCHLIST_REVISION` is the BUYER's own watch list (`buy.watchlist.read`). The live topic list had 27 entries on this date.
