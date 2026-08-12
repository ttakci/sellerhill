-- apps/api/migrations/071_predefined_templates_catalog.sql
-- The listing description template catalog. This file, not application code, is
-- the source of truth: ListingSettingsGroupService.seedPredefinedTemplates (a
-- hardcoded TS array upserted on every API boot) is deleted in the same change.
--
-- HOW TO CHANGE A TEMPLATE, OR ADD ONE: copy this file to the next migration
-- number and edit there. An applied migration NEVER re-runs — MigrationRunner
-- tracks files by name, so editing this one is a silent no-op (same rule that
-- forced migration 061 to exist rather than amending 060).
--
-- Two invariants make the upsert safe:
--   * ON CONFLICT targets `slug`, the natural key added by 070. The two rows
--     that already exist in every deployed database adopt slugs derived from
--     their names, so they are UPDATED here rather than duplicated.
--   * `id` and `created_at` are NOT in the DO UPDATE SET list. Groups reference
--     `id` from inside `listing_settings_groups.templates` JSONB with no foreign
--     key; rewriting it would silently detach every user's template choice and
--     degrade their listings to DEFAULT_LISTING_TEMPLATE_HTML on publish. This
--     omission is the single most important line in the file.
--
-- TEMPLATE AUTHORING RULES (all enforced by predefined-templates.guard.spec.ts):
--   * Allowed placeholders: title, product_description, feature_bullets,
--     product_details, brand, manufacturer, category, and
--     the presence flags has_features / has_details / has_images.
--   * BANNED placeholders:
--       - condition, quantity — the publish path never passes them
--         (listing-strategy.service.ts processDescriptionTemplate), so they
--         always render empty on a live listing.
--       - price, currency — these carry the AMAZON SOURCE price, not the eBay
--         price: processDescriptionTemplate runs before calculatePrice and
--         builds its context from product.price.current. Publishing them would
--         put the seller's cost in front of the buyer.
--       - asin — an Amazon identifier in buyer-visible text.
--   * No <link>, <script>, <iframe>, <form>, <object>, <embed>, <meta>, <base>,
--     no on*= handlers: sanitizeListingHtml strips them before publish, so they
--     are dead markup that makes the seed diverge from what actually ships.
--     (That is the bug this migration fixes in Elite Trust, which shipped a
--     Google Fonts <link> and therefore never got the font it styled for.)
--   * No <a href> at all — eBay forbids off-site links in descriptions and the
--     sanitizer does NOT strip them. No email addresses or phone numbers.
--   * No web fonts, no @import, no data: URIs. System font stacks only.
--   * <style> is allowed and expected, but EVERY selector must start with a
--     class in that template's own namespace — this HTML is also injected into
--     the app document by the settings-drawer preview, so a bare `h1 {}` would
--     restyle the application. No CSS attribute selectors either (the sanitizer's
--     unquoted on*= pattern is a blunt regex).
--   * A section cannot nest inside a section of the same key, so a LIST block is
--     wrapped in its presence flag ({{#has_details}}) rather than in itself.
--   * Product images may be rendered: their Keepa URLs are source-hosted and
--     may contain the source marketplace name inside src. That URL attribute is
--     the ONLY allowed occurrence; visible text, classes, styles and every other
--     attribute must remain source-neutral.
--   * Static trust copy stays non-committal — no invented shipping windows or
--     return periods that could contradict the seller's real eBay business
--     policies. And never the literal word "Amazon": a seller's own blacklist
--     runs over the rendered description's visible text.

INSERT INTO predefined_templates (slug, name, description, html_content, sample_data, sort_order, is_active) VALUES

-- ---------------------------------------------------------------------------
-- 10. Modern Professional (pre-existing row, adopted by slug)
-- Unchanged layout and CSS. The only edits are empty-state guards: the three
-- content blocks now collapse instead of rendering a styled heading over a void.
-- ---------------------------------------------------------------------------
(
  'modern-professional',
  'Modern Professional',
  $desc_modern_professional$Clean typography and a professional two-column layout for high-end products$desc_modern_professional$,
  $html_modern_professional$<div class="sellerhill-listing">
  <div class="sellerhill-content">
    <h1 class="sellerhill-title">{{title}}</h1>
    <div class="sellerhill-grid">
      {{#main_image}}<div class="sellerhill-image-col"><div class="sellerhill-image-box"><img src="{{.}}" alt="{{title}}"></div></div>{{/main_image}}
      <div class="sellerhill-details-col">
        {{#has_details}}<div class="sellerhill-section"><h2 class="sellerhill-section-title">Product Details</h2><ul class="sellerhill-list">{{#product_details}}<li>{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
        {{#has_features}}<div class="sellerhill-section"><h2 class="sellerhill-section-title">Key Features</h2><ul class="sellerhill-list">{{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
      </div>
    </div>
    {{#product_description}}<div class="sellerhill-description"><h2 class="sellerhill-section-title">Full Description</h2><div class="sellerhill-prose">{{{product_description}}}</div></div>{{/product_description}}
  </div>
</div>
<style>
.sellerhill-listing { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1e293b; line-height: 1.6; font-size: 15px; max-width: 1000px; margin: 0 auto; padding: 20px; }
.sellerhill-listing img { max-width: 100%; height: auto; }
.sellerhill-title { font-size: 28px; font-weight: 700; line-height: 1.3; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin: 0 0 32px 0; }
.sellerhill-grid { display: flex; flex-wrap: wrap; gap: 40px; margin-bottom: 40px; }
.sellerhill-image-col { flex: 1 1 300px; max-width: 450px; }
.sellerhill-details-col { flex: 1.2 1 320px; }
.sellerhill-image-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
.sellerhill-image-box img { max-width: 100%; border-radius: 8px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.sellerhill-section { margin-bottom: 28px; }
.sellerhill-section-title { font-size: 17px; font-weight: 600; color: #334155; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0; border-left: 4px solid #3b82f6; padding-left: 12px; }
.sellerhill-list { list-style: none; padding: 0; margin: 0; }
.sellerhill-list li { margin-bottom: 8px; position: relative; padding-left: 20px; }
.sellerhill-list li::before { content: "\2022"; color: #3b82f6; position: absolute; left: 0; font-weight: bold; }
.sellerhill-description { background: #f1f5f9; padding: 32px; border-radius: 12px; margin-top: 40px; }
.sellerhill-prose { margin: 0; }
.sellerhill-prose img { border-radius: 8px; }
@media (max-width: 768px) {
  .sellerhill-listing { padding: 16px; }
  .sellerhill-grid { gap: 24px; }
  .sellerhill-image-col { max-width: 100%; }
  .sellerhill-description { padding: 20px; }
}
</style>$html_modern_professional$,
  $json_modern_professional${
      "title": "Premium Wireless Noise Cancelling Headphones - Silver Edition",
      "main_image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Industry-leading noise cancellation",
          "Up to 30-hour battery life",
          "Touch sensor controls",
          "Quick attention mode"
      ],
      "product_details": [
          "Brand: SellerHill Audio",
          "Connectivity: Bluetooth 5.0",
          "Noise Cancelling: Yes",
          "Color: Silver"
      ],
      "product_description": "Experience world-class noise cancellation and premium sound quality with these high-end wireless headphones. Perfect for travel, work, or pure listening pleasure."
  }$json_modern_professional$::jsonb,
  10,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 20. Elite Trust (pre-existing row, adopted by slug)
-- THE FIX: the Google Fonts <link> is gone and the font-family is a system
-- stack. sanitizeListingHtml strips <link> before publish, so the live listing
-- never had Inter and fell back to the browser default with no stack declared.
-- Trust copy is left byte-identical — existing sellers are already using it and
-- silently rewording their listings would be a surprise.
-- ---------------------------------------------------------------------------
(
  'elite-trust',
  'Elite Trust',
  $desc_elite_trust$Buyer-confidence layout with clear handling, delivery and guarantee blocks$desc_elite_trust$,
  $html_elite_trust$<div class="elite-wrapper">
  <div class="elite-header">
    <h1>{{title}}</h1>
  </div>
  <div class="elite-main">
    {{#main_image}}<div class="elite-image-center"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    <div class="elite-container">
      <div class="elite-section">
        {{#product_description}}<h3><span class="elite-icon">&#128203;</span> Product Overview</h3><div class="elite-prose">{{{product_description}}}</div>{{/product_description}}
        {{#has_features}}<ul class="elite-features">{{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}</ul>{{/has_features}}
      </div>
      <div class="elite-policies">
        <div class="elite-policy-item">
          <h4><span class="elite-icon">&#128666;</span> Fast Handling</h4>
          <p>We process all orders within <strong>24-48 hours</strong> of payment confirmation.</p>
        </div>
        <div class="elite-policy-item">
          <h4><span class="elite-icon">&#128230;</span> Secure Delivery</h4>
          <p>Orders are shipped with premium tracking. Continental US shipping only.</p>
        </div>
        <div class="elite-policy-item">
          <h4><span class="elite-icon">&#128737;</span> 30-Day Guarantee</h4>
          <p>Not satisfied? Return within 30 days for a full refund. Peace of mind guaranteed.</p>
        </div>
        <div class="elite-policy-item">
          <h4><span class="elite-icon">&#11088;</span> Reliable Feedback</h4>
          <p>Our reputation is based on trust. Contact us first if you have any issues with your order.</p>
        </div>
      </div>
    </div>
  </div>
</div>
<style>
.elite-wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #fff; max-width: 900px; margin: 0 auto; color: #2d3748; line-height: 1.6; font-size: 15px; }
.elite-wrapper img { max-width: 100%; height: auto; }
.elite-header { background: #1a202c; color: #fff; padding: 40px 20px; text-align: center; }
.elite-header h1 { font-size: 24px; margin: 0 auto; max-width: 800px; line-height: 1.4; }
.elite-main { padding: 40px 20px; }
.elite-image-center { text-align: center; margin-bottom: 40px; }
.elite-image-center img { max-width: 500px; border: 1px solid #edf2f7; border-radius: 8px; }
.elite-container { display: grid; grid-template-columns: 1fr 300px; gap: 40px; }
.elite-section h3 { font-size: 18px; margin-top: 0; padding-bottom: 12px; border-bottom: 1px solid #edf2f7; }
.elite-prose { margin: 0 0 20px 0; }
.elite-features { padding-left: 20px; margin-top: 20px; }
.elite-features li { margin-bottom: 10px; }
.elite-policies { background: #f7fafc; padding: 24px; border-radius: 8px; }
.elite-policy-item { margin-bottom: 24px; }
.elite-policy-item:last-child { margin-bottom: 0; }
.elite-policy-item h4 { margin: 0 0 8px 0; display: flex; align-items: center; font-size: 14px; text-transform: uppercase; color: #4a5568; }
.elite-policy-item p { font-size: 13px; margin: 0; color: #718096; }
.elite-icon { margin-right: 8px; font-size: 18px; }
@media (max-width: 768px) {
  .elite-header { padding: 28px 16px; }
  .elite-main { padding: 24px 16px; }
  .elite-container { grid-template-columns: 1fr; gap: 28px; }
}
</style>$html_elite_trust$,
  $json_elite_trust${
      "title": "EliteBook X360 1040 G8 Laptop - 14 inch Touchscreen, Core i7, 16GB RAM, 512GB SSD",
      "main_image": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&q=80&w=1000",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "11th Gen Intel Core i7 processor for blazing fast speeds",
          "16GB High-Speed RAM for seamless multitasking",
          "512GB NVMe SSD storage for instant boot times",
          "14-inch Full HD x360 Touchscreen display",
          "Backlit Keyboard and Fingerprint reader for security"
      ],
      "product_details": [
          "Brand: HP",
          "Model: EliteBook X360 1040 G8",
          "Processor: Intel Core i7-1185G7",
          "Operating System: Windows 11 Pro",
          "Color: Silver"
      ],
      "product_description": "Experience professional performance with the EliteBook X360. This versatile 2-in-1 laptop features a stunning 14-inch touchscreen and powerful internals for maximum productivity."
  }$json_elite_trust$::jsonb,
  20,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 30. Spec Sheet — technical / electronics. Dark header strip with brand and
-- category chips, a zebra-striped specification table, then highlights.
-- ---------------------------------------------------------------------------
(
  'spec-sheet',
  'Spec Sheet',
  $desc_spec_sheet$Technical layout with a full specification table - best for electronics, tools and parts$desc_spec_sheet$,
  $html_spec_sheet$<div class="zss-root">
  <div class="zss-head">
    <div class="zss-head-main">
      <div class="zss-chips">{{#brand}}<span class="zss-chip">{{.}}</span>{{/brand}}{{#category}}<span class="zss-chip zss-chip-soft">{{.}}</span>{{/category}}</div>
      <h1 class="zss-title">{{title}}</h1>
    </div>
    {{#main_image}}<div class="zss-head-media"><img class="zss-media-img" src="{{.}}" alt="{{title}}"></div>{{/main_image}}
  </div>
  <div class="zss-body">
    {{#product_description}}<div class="zss-block"><h2 class="zss-h2">Overview</h2><div class="zss-prose">{{{product_description}}}</div></div>{{/product_description}}
    {{#has_details}}<div class="zss-block"><h2 class="zss-h2">Specifications</h2><table class="zss-table"><tbody>{{#product_details}}<tr><td class="zss-cell">{{.}}</td></tr>{{/product_details}}</tbody></table></div>{{/has_details}}
    {{#has_features}}<div class="zss-block"><h2 class="zss-h2">Highlights</h2><ul class="zss-list">{{#feature_bullets}}<li class="zss-item">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
  </div>
</div>
<style>
.zss-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111827; line-height: 1.6; font-size: 15px; max-width: 960px; margin: 0 auto; background: #fff; }
.zss-root img { max-width: 100%; height: auto; }
.zss-head { display: flex; flex-wrap: wrap; align-items: center; gap: 24px; background: #1e293b; color: #f8fafc; padding: 28px 24px; }
.zss-head-main { flex: 1 1 320px; min-width: 0; }
.zss-head-media { flex: 0 0 160px; text-align: center; }
.zss-media-img { max-width: 160px; background: #fff; border-radius: 8px; padding: 8px; }
.zss-chips { margin-bottom: 10px; }
.zss-chip { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: #38bdf8; color: #0b1220; border-radius: 999px; padding: 4px 12px; margin: 0 6px 6px 0; }
.zss-chip-soft { background: #334155; color: #cbd5e1; }
.zss-title { font-size: 25px; font-weight: 700; line-height: 1.3; margin: 0; }
.zss-body { padding: 28px 24px 32px 24px; }
.zss-block { margin-bottom: 32px; }
.zss-block:last-child { margin-bottom: 0; }
.zss-h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #0284c7; margin: 0 0 14px 0; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
.zss-prose { margin: 0; color: #334155; }
.zss-table { width: 100%; border-collapse: collapse; }
.zss-table tr:nth-child(odd) { background: #f8fafc; }
.zss-cell { padding: 10px 14px; font-size: 14px; color: #1f2937; border-bottom: 1px solid #eef2f7; word-break: break-word; }
.zss-list { list-style: none; margin: 0; padding: 0; }
.zss-item { position: relative; padding-left: 26px; margin-bottom: 10px; color: #334155; }
.zss-item::before { content: "\2713"; position: absolute; left: 0; top: 0; color: #059669; font-weight: 700; }
@media (max-width: 768px) {
  .zss-head { padding: 22px 16px; gap: 16px; }
  .zss-head-media { flex: 1 1 100%; }
  .zss-title { font-size: 21px; }
  .zss-body { padding: 22px 16px 26px 16px; }
}
</style>$html_spec_sheet$,
  $json_spec_sheet${
      "brand": "TorqueLine",
      "title": "Cordless Impact Driver Kit 20V Brushless with 2 Batteries and Fast Charger",
      "category": "Power Tools",
      "main_image": "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Brushless motor for longer runtime and tool life",
          "1,800 in-lbs of maximum fastening torque",
          "Three-speed selector with precision mode",
          "LED ring light with 20-second delay",
          "Belt hook and magnetic bit holder included"
      ],
      "product_details": [
          "Brand: TorqueLine",
          "Voltage: 20V MAX",
          "Chuck Size: 1/4 in Hex",
          "No Load Speed: 0-3,250 RPM",
          "Battery Type: Lithium-Ion",
          "Item Weight: 2.4 lb",
          "Included Components: Driver, 2 Batteries, Charger, Case"
      ],
      "product_description": "A compact brushless impact driver built for all-day use. Delivers high torque in a short head length so it reaches into tight cabinet and framing work without a right-angle adapter."
  }$json_spec_sheet$::jsonb,
  30,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 40. Gallery Grid — the only template that renders the full {{#images}} set.
-- For sellers who want the whole photo set inside the description as well as in
-- the eBay gallery.
-- ---------------------------------------------------------------------------
(
  'gallery-grid',
  'Gallery Grid',
  $desc_gallery_grid$Photo-led layout that shows the complete image set beneath a large hero shot$desc_gallery_grid$,
  $html_gallery_grid$<div class="zgg-root">
  <h1 class="zgg-title">{{title}}</h1>
  {{#main_image}}<div class="zgg-hero"><img class="zgg-hero-img" src="{{.}}" alt="{{title}}"></div>{{/main_image}}
  {{#has_images}}<div class="zgg-strip">{{#images}}<span class="zgg-cell"><img class="zgg-thumb" src="{{.}}" alt="{{title}}"></span>{{/images}}</div>{{/has_images}}
  {{#product_description}}<div class="zgg-panel"><h2 class="zgg-h2">About this item</h2><div class="zgg-prose">{{{product_description}}}</div></div>{{/product_description}}
  {{#has_features}}<div class="zgg-panel"><h2 class="zgg-h2">Key features</h2><ul class="zgg-list">{{#feature_bullets}}<li class="zgg-item">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
</div>
<style>
.zgg-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #18181b; line-height: 1.65; font-size: 15px; max-width: 940px; margin: 0 auto; padding: 24px; background: #fff; }
.zgg-root img { max-width: 100%; height: auto; }
.zgg-title { font-size: 26px; font-weight: 700; line-height: 1.3; margin: 0 0 20px 0; }
.zgg-hero { background: #fafafa; border: 1px solid #ececee; border-radius: 14px; padding: 24px; text-align: center; }
.zgg-hero-img { max-width: 560px; border-radius: 10px; }
.zgg-strip { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
.zgg-cell { flex: 0 0 auto; background: #fafafa; border: 1px solid #ececee; border-radius: 10px; padding: 8px; line-height: 0; }
.zgg-thumb { width: 104px; height: 104px; object-fit: contain; border-radius: 6px; }
.zgg-panel { margin-top: 32px; }
.zgg-h2 { font-size: 17px; font-weight: 600; margin: 0 0 12px 0; padding-bottom: 10px; border-bottom: 1px solid #ececee; }
.zgg-prose { margin: 0; color: #3f3f46; }
.zgg-list { list-style: none; margin: 0; padding: 0; }
.zgg-item { position: relative; padding-left: 22px; margin-bottom: 9px; color: #3f3f46; }
.zgg-item::before { content: "\2014"; position: absolute; left: 0; color: #a1a1aa; }
@media (max-width: 768px) {
  .zgg-root { padding: 16px; }
  .zgg-title { font-size: 21px; }
  .zgg-hero { padding: 14px; }
  .zgg-thumb { width: 76px; height: 76px; }
}
</style>$html_gallery_grid$,
  $json_gallery_grid${
      "title": "Ceramic Non-Stick Cookware Set 12 Piece with Glass Lids and Utensils",
      "images": [
          "https://images.unsplash.com/photo-1584990347449-a40cb3e1f4d1?auto=format&fit=crop&q=80&w=400",
          "https://images.unsplash.com/photo-1556909212-d5b604d0c90d?auto=format&fit=crop&q=80&w=400",
          "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&q=80&w=400",
          "https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&q=80&w=400"
      ],
      "has_images": "1",
      "main_image": "https://images.unsplash.com/photo-1584990347449-a40cb3e1f4d1?auto=format&fit=crop&q=80&w=900",
      "has_features": "1",
      "feature_bullets": [
          "Ceramic non-stick coating, free of PFOA and PTFE",
          "Tempered glass lids with steam vents",
          "Stay-cool riveted handles",
          "Induction ready and oven safe to 450F",
          "Dishwasher safe"
      ],
      "product_description": "A complete ceramic-coated set that covers everyday cooking, from a small saucepan to a family-size stockpot. The coating releases food without added oil and wipes clean in seconds."
  }$json_gallery_grid$::jsonb,
  40,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 50. Minimal Mono — deliberately contains NO <img> tag at all. Product images
-- are source-hosted, so a template that renders them puts that host in the
-- listing page source. The eBay gallery photos are uploaded separately and are
-- unaffected, so this remains the strict zero-source-URL option.
-- ---------------------------------------------------------------------------
(
  'minimal-mono',
  'Minimal Mono',
  $desc_minimal_mono$Text-only editorial layout with no images at all - the lightest, most neutral option$desc_minimal_mono$,
  $html_minimal_mono$<div class="zmm-root">
  <div class="zmm-head">
    {{#brand}}<div class="zmm-eyebrow">{{.}}</div>{{/brand}}
    <h1 class="zmm-title">{{title}}</h1>
  </div>
  {{#product_description}}<div class="zmm-block"><div class="zmm-label">Description</div><div class="zmm-prose">{{{product_description}}}</div></div>{{/product_description}}
  {{#has_features}}<div class="zmm-block"><div class="zmm-label">Features</div><ul class="zmm-list">{{#feature_bullets}}<li class="zmm-item">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
  {{#has_details}}<div class="zmm-block"><div class="zmm-label">Details</div><ul class="zmm-cols">{{#product_details}}<li class="zmm-col-item">{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
</div>
<style>
.zmm-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1c1917; line-height: 1.7; font-size: 15px; max-width: 780px; margin: 0 auto; padding: 32px 24px; background: #fff; }
.zmm-head { padding-bottom: 24px; border-bottom: 1px solid #1c1917; margin-bottom: 32px; }
.zmm-eyebrow { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #78716c; margin-bottom: 10px; }
.zmm-title { font-size: 27px; font-weight: 600; line-height: 1.28; margin: 0; }
.zmm-block { margin-bottom: 34px; }
.zmm-block:last-child { margin-bottom: 0; }
.zmm-label { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #a8a29e; margin-bottom: 12px; }
.zmm-prose { margin: 0; color: #292524; }
.zmm-list { list-style: none; margin: 0; padding: 0; }
.zmm-item { position: relative; padding-left: 20px; margin-bottom: 10px; }
.zmm-item::before { content: "\2014"; position: absolute; left: 0; color: #d6d3d1; }
.zmm-cols { list-style: none; margin: 0; padding: 0; column-count: 2; column-gap: 32px; }
.zmm-col-item { font-size: 14px; color: #57534e; padding: 7px 0; border-bottom: 1px solid #f5f5f4; break-inside: avoid; }
@media (max-width: 768px) {
  .zmm-root { padding: 22px 16px; }
  .zmm-title { font-size: 22px; }
  .zmm-cols { column-count: 1; }
}
</style>$html_minimal_mono$,
  $json_minimal_mono${
      "brand": "Northfold Home",
      "title": "Organic Cotton Percale Sheet Set - Queen, 400 Thread Count, Deep Pocket",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "GOTS certified organic long-staple cotton",
          "400 thread count percale weave",
          "Fits mattresses up to 16 inches deep",
          "Four-piece set: flat, fitted and two pillowcases",
          "Machine washable, no shrinkage after first wash"
      ],
      "product_details": [
          "Brand: Northfold Home",
          "Size: Queen",
          "Material: 100% Organic Cotton",
          "Weave: Percale",
          "Thread Count: 400",
          "Pocket Depth: 16 in",
          "Care: Machine Wash Cold",
          "Included: 4 Pieces"
      ],
      "product_description": "Long-staple organic cotton woven in a crisp percale finish that stays cool through the night and softens with every wash. Deep pockets hold a mattress up to 16 inches."
  }$json_minimal_mono$::jsonb,
  50,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 60. Boutique Card — warm, serif, centered. Home, beauty and fashion; leads on
-- feel rather than specification.
-- ---------------------------------------------------------------------------
(
  'boutique-card',
  'Boutique Card',
  $desc_boutique_card$Warm serif card layout for home, beauty and fashion listings$desc_boutique_card$,
  $html_boutique_card$<div class="zbc-stage">
  <div class="zbc-card">
    <div class="zbc-head">
      {{#brand}}<div class="zbc-brand">{{.}}</div>{{/brand}}
      <h1 class="zbc-title">{{title}}</h1>
      <div class="zbc-rule"></div>
    </div>
    {{#main_image}}<div class="zbc-media"><img class="zbc-img" src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    {{#product_description}}<div class="zbc-prose">{{{product_description}}}</div>{{/product_description}}
    {{#has_features}}<div class="zbc-chips">{{#feature_bullets}}<span class="zbc-chip">{{.}}</span>{{/feature_bullets}}</div>{{/has_features}}
    {{#has_details}}<div class="zbc-glance"><div class="zbc-glance-label">At a glance</div><ul class="zbc-glance-list">{{#product_details}}<li class="zbc-glance-item">{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
  </div>
</div>
<style>
.zbc-stage { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f6f1ea; padding: 32px 16px; line-height: 1.7; font-size: 15px; color: #43342a; }
.zbc-card { max-width: 820px; margin: 0 auto; background: #fffdfb; border: 1px solid #e9ded1; border-radius: 18px; padding: 40px 36px; }
.zbc-card img { max-width: 100%; height: auto; }
.zbc-head { text-align: center; margin-bottom: 28px; }
.zbc-brand { font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; color: #a3846b; margin-bottom: 12px; }
.zbc-title { font-family: Georgia, Cambria, "Times New Roman", Times, serif; font-size: 27px; font-weight: 400; line-height: 1.35; margin: 0; color: #3a2b21; }
.zbc-rule { width: 56px; height: 2px; background: #d8bfa4; margin: 20px auto 0 auto; }
.zbc-media { text-align: center; margin-bottom: 28px; }
.zbc-img { max-width: 460px; border-radius: 14px; }
.zbc-prose { margin: 0 auto 26px auto; max-width: 640px; text-align: center; color: #5b4636; }
.zbc-chips { text-align: center; margin-bottom: 30px; }
.zbc-chip { display: inline-block; background: #f6f1ea; border: 1px solid #e9ded1; border-radius: 999px; padding: 7px 16px; margin: 0 6px 8px 0; font-size: 13px; color: #6b5443; }
.zbc-glance { background: #faf6f1; border-radius: 12px; padding: 24px 26px; }
.zbc-glance-label { font-family: Georgia, Cambria, "Times New Roman", Times, serif; font-size: 17px; color: #3a2b21; margin-bottom: 14px; text-align: center; }
.zbc-glance-list { list-style: none; margin: 0; padding: 0; }
.zbc-glance-item { font-size: 14px; color: #6b5443; padding: 9px 0; border-bottom: 1px solid #efe6dc; }
.zbc-glance-item:last-child { border-bottom: none; }
@media (max-width: 768px) {
  .zbc-stage { padding: 18px 10px; }
  .zbc-card { padding: 26px 18px; border-radius: 14px; }
  .zbc-title { font-size: 22px; }
  .zbc-glance { padding: 18px; }
}
</style>$html_boutique_card$,
  $json_boutique_card${
      "brand": "Vellum & Vine",
      "title": "Hand-Poured Soy Candle Trio - Fig, Cedar and Sea Salt, 8 oz Each",
      "main_image": "https://images.unsplash.com/photo-1602874801007-aa14b8b0dd0a?auto=format&fit=crop&q=80&w=900",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "100% soy wax",
          "Cotton wick",
          "50 hour burn",
          "Reusable glass",
          "Gift boxed"
      ],
      "product_details": [
          "Brand: Vellum & Vine",
          "Set Size: 3 Candles",
          "Net Weight: 8 oz each",
          "Wax Type: Soy",
          "Burn Time: 50 hours",
          "Scent Family: Fig, Cedar, Sea Salt"
      ],
      "product_description": "Three small-batch candles poured into reusable amber glass. Each burns clean for roughly fifty hours and fills a room without overwhelming it."
  }$json_boutique_card$::jsonb,
  60,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 70. Compact Mobile — single column at every width, features above the
-- description because buyers scan bullets first. No media query needed.
-- ---------------------------------------------------------------------------
(
  'compact-mobile',
  'Compact Mobile',
  $desc_compact_mobile$Single-column layout tuned for the eBay mobile app, with features shown first$desc_compact_mobile$,
  $html_compact_mobile$<div class="zcm-root">
  <h1 class="zcm-title">{{title}}</h1>
  {{#main_image}}<div class="zcm-media"><img class="zcm-img" src="{{.}}" alt="{{title}}"></div>{{/main_image}}
  {{#has_features}}<ul class="zcm-list">{{#feature_bullets}}<li class="zcm-item">{{.}}</li>{{/feature_bullets}}</ul>{{/has_features}}
  {{#product_description}}<div class="zcm-block"><h2 class="zcm-h2">Description</h2><div class="zcm-prose">{{{product_description}}}</div></div>{{/product_description}}
  {{#has_details}}<div class="zcm-block"><h2 class="zcm-h2">Details</h2><ul class="zcm-rows">{{#product_details}}<li class="zcm-row">{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
  <div class="zcm-assure">
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128230;</div><div class="zcm-assure-text">Carefully packed</div></div>
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128666;</div><div class="zcm-assure-text">Tracked delivery</div></div>
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128737;</div><div class="zcm-assure-text">Returns accepted</div></div>
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128172;</div><div class="zcm-assure-text">Message us anytime</div></div>
  </div>
</div>
<style>
.zcm-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; line-height: 1.65; font-size: 16px; max-width: 620px; margin: 0 auto; padding: 20px 18px; background: #fff; }
.zcm-root img { max-width: 100%; height: auto; }
.zcm-title { font-size: 24px; font-weight: 700; line-height: 1.32; margin: 0 0 18px 0; }
.zcm-media { text-align: center; margin-bottom: 20px; }
.zcm-img { max-width: 100%; border-radius: 12px; }
.zcm-list { list-style: none; margin: 0 0 26px 0; padding: 0; }
.zcm-item { position: relative; padding: 11px 0 11px 30px; border-bottom: 1px solid #f1f5f9; font-weight: 500; }
.zcm-item::before { content: "\2713"; position: absolute; left: 2px; top: 11px; color: #16a34a; font-weight: 700; }
.zcm-block { margin-bottom: 26px; }
.zcm-h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; margin: 0 0 10px 0; }
.zcm-prose { margin: 0; color: #334155; }
.zcm-rows { list-style: none; margin: 0; padding: 0; }
.zcm-row { font-size: 15px; color: #475569; padding: 9px 0; border-bottom: 1px solid #f1f5f9; }
.zcm-assure { display: flex; flex-wrap: wrap; gap: 12px; background: #f8fafc; border-radius: 12px; padding: 18px 14px; margin-top: 28px; }
.zcm-assure-cell { flex: 1 1 120px; text-align: center; }
.zcm-assure-icon { font-size: 22px; line-height: 1.2; }
.zcm-assure-text { font-size: 12px; color: #64748b; margin-top: 6px; }
</style>$html_compact_mobile$,
  $json_compact_mobile${
      "title": "Insulated Stainless Steel Water Bottle 32 oz with Straw Lid and Handle",
      "main_image": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Cold 24 hours, hot 12 hours",
          "Fits most car cup holders",
          "Two interchangeable lids included",
          "Powder-coated, sweat-free exterior",
          "18/8 food grade stainless steel"
      ],
      "product_details": [
          "Capacity: 32 oz",
          "Material: 18/8 Stainless Steel",
          "Insulation: Double Wall Vacuum",
          "Lid Type: Straw and Flat Sip",
          "Color: Matte Charcoal",
          "Care: Hand Wash"
      ],
      "product_description": "Double-wall vacuum insulation keeps drinks cold for 24 hours and hot for 12. The wide mouth takes standard ice cubes and the straw lid swaps for a flat sip lid in seconds."
  }$json_compact_mobile$::jsonb,
  70,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 80. Brand Story — editorial / private-label. Brand masthead over the title,
-- pull-quote description, two-column features, muted detail footer.
-- ---------------------------------------------------------------------------
(
  'brand-story',
  'Brand Story',
  $desc_brand_story$Editorial layout that leads with the brand - suits private-label and branded goods$desc_brand_story$,
  $html_brand_story$<div class="zbs-root">
  <div class="zbs-masthead">
    {{#brand}}<div class="zbs-brand">{{.}}</div>{{/brand}}
    {{^brand}}{{#manufacturer}}<div class="zbs-brand">{{.}}</div>{{/manufacturer}}{{/brand}}
    <h1 class="zbs-title">{{title}}</h1>
  </div>
  {{#main_image}}<div class="zbs-media"><img class="zbs-img" src="{{.}}" alt="{{title}}"></div>{{/main_image}}
  {{#product_description}}<div class="zbs-quote"><div class="zbs-prose">{{{product_description}}}</div></div>{{/product_description}}
  {{#has_features}}<div class="zbs-section"><h2 class="zbs-h2">What you get</h2><ul class="zbs-grid">{{#feature_bullets}}<li class="zbs-cell">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
  {{#has_details}}<div class="zbs-footer"><h2 class="zbs-h2 zbs-h2-muted">Specification</h2><ul class="zbs-rows">{{#product_details}}<li class="zbs-row">{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
</div>
<style>
.zbs-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #10241c; line-height: 1.7; font-size: 15px; max-width: 900px; margin: 0 auto; padding: 34px 26px; background: #fff; }
.zbs-root img { max-width: 100%; height: auto; }
.zbs-masthead { text-align: center; margin-bottom: 30px; }
.zbs-brand { font-size: 12px; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; color: #12805c; margin-bottom: 14px; }
.zbs-title { font-size: 27px; font-weight: 600; line-height: 1.3; margin: 0; color: #10241c; }
.zbs-media { text-align: center; margin-bottom: 32px; }
.zbs-img { max-width: 520px; border-radius: 12px; }
.zbs-quote { background: #f2f8f5; border-left: 4px solid #12805c; border-radius: 0 12px 12px 0; padding: 26px 30px; margin-bottom: 34px; }
.zbs-prose { margin: 0; font-size: 16px; color: #24473b; }
.zbs-section { margin-bottom: 34px; }
.zbs-h2 { font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #12805c; margin: 0 0 16px 0; }
.zbs-h2-muted { color: #7c8b85; }
.zbs-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 28px; }
.zbs-cell { position: relative; padding-left: 20px; color: #2f4a41; }
.zbs-cell::before { content: "\25CF"; position: absolute; left: 0; top: 0; font-size: 9px; line-height: 2.6; color: #12805c; }
.zbs-footer { border-top: 1px solid #e4ece8; padding-top: 26px; }
.zbs-rows { list-style: none; margin: 0; padding: 0; }
.zbs-row { font-size: 14px; color: #62736d; padding: 8px 0; border-bottom: 1px solid #f1f5f3; }
.zbs-row:last-child { border-bottom: none; }
@media (max-width: 768px) {
  .zbs-root { padding: 22px 16px; }
  .zbs-title { font-size: 22px; }
  .zbs-quote { padding: 18px 20px; }
  .zbs-grid { grid-template-columns: 1fr; }
}
</style>$html_brand_story$,
  $json_brand_story${
      "brand": "Marrahouse",
      "title": "Cold Pressed Argan Oil Hair and Skin Serum 100ml with Glass Dropper",
      "main_image": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&q=80&w=900",
      "has_details": "1",
      "has_features": "1",
      "manufacturer": "Marrahouse Naturals",
      "feature_bullets": [
          "100% pure cold-pressed argan oil",
          "Unfiltered and undiluted",
          "Amber glass bottle with dropper",
          "Suitable for hair, face and nails",
          "Cruelty free",
          "Sourced from a single cooperative"
      ],
      "product_details": [
          "Brand: Marrahouse",
          "Volume: 100 ml",
          "Extraction: Cold Pressed",
          "Ingredients: 100% Argania Spinosa Kernel Oil",
          "Skin Type: All",
          "Packaging: Amber Glass with Dropper"
      ],
      "product_description": "Single-origin argan kernels, cold pressed in small batches and bottled unfiltered. Nothing is added and nothing is diluted, which is why the colour varies slightly from harvest to harvest."
  }$json_brand_story$::jsonb,
  80,
  TRUE
)

ON CONFLICT (slug) DO UPDATE SET
  name         = EXCLUDED.name,
  description  = EXCLUDED.description,
  html_content = EXCLUDED.html_content,
  sample_data  = EXCLUDED.sample_data,
  sort_order   = EXCLUDED.sort_order,
  is_active    = EXCLUDED.is_active,
  updated_at   = NOW();
