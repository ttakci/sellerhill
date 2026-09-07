-- apps/api/migrations/072_predefined_templates_v2.sql
-- The listing description template catalog (v2). This migration upgrades the 
-- existing 8 templates with a much more polished, modern, and elegant design
-- and introduces 4 new templates: neon-gamer, vintage-craft, auto-parts-pro, luxury-gold.
--
-- See 071_predefined_templates_catalog.sql for architectural rules.

INSERT INTO predefined_templates (slug, name, description, html_content, sample_data, sort_order, is_active) VALUES

-- ---------------------------------------------------------------------------
-- 10. Modern Professional
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
.sellerhill-listing { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #334155; line-height: 1.65; font-size: 15px; max-width: 1000px; margin: 0 auto; padding: 24px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.03); }
.sellerhill-listing img { max-width: 100%; height: auto; }
.sellerhill-title { font-size: 30px; font-weight: 800; line-height: 1.25; color: #0f172a; margin: 0 0 36px 0; letter-spacing: -0.02em; }
.sellerhill-grid { display: flex; flex-wrap: wrap; gap: 48px; margin-bottom: 48px; }
.sellerhill-image-col { flex: 1 1 320px; max-width: 480px; }
.sellerhill-details-col { flex: 1.2 1 320px; }
.sellerhill-image-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; display: flex; align-items: center; justify-content: center; min-height: 300px; }
.sellerhill-image-box img { max-width: 100%; border-radius: 10px; box-shadow: 0 12px 24px -8px rgba(0,0,0,0.12); transition: transform 0.3s ease; }
.sellerhill-image-box:hover img { transform: translateY(-4px); }
.sellerhill-section { margin-bottom: 32px; background: #ffffff; }
.sellerhill-section-title { font-size: 14px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 20px 0; display: flex; align-items: center; }
.sellerhill-section-title::after { content: ""; flex: 1; height: 1px; background: #e2e8f0; margin-left: 16px; }
.sellerhill-list { list-style: none; padding: 0; margin: 0; }
.sellerhill-list li { margin-bottom: 12px; position: relative; padding-left: 24px; color: #475569; }
.sellerhill-list li::before { content: ""; position: absolute; left: 0; top: 8px; width: 6px; height: 6px; background-color: #3b82f6; border-radius: 50%; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
.sellerhill-description { background: linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%); padding: 36px; border-radius: 16px; margin-top: 48px; border: 1px solid #e2e8f0; }
.sellerhill-prose { margin: 0; font-size: 16px; color: #334155; }
.sellerhill-prose img { border-radius: 10px; margin: 16px 0; }
@media (max-width: 768px) {
  .sellerhill-listing { padding: 16px; border-radius: 8px; box-shadow: none; }
  .sellerhill-title { font-size: 24px; margin-bottom: 24px; }
  .sellerhill-grid { gap: 32px; margin-bottom: 32px; }
  .sellerhill-image-col { max-width: 100%; }
  .sellerhill-description { padding: 24px; margin-top: 32px; }
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
-- 20. Elite Trust
-- ---------------------------------------------------------------------------
(
  'elite-trust',
  'Elite Trust',
  $desc_elite_trust$Buyer-confidence layout with clear handling, delivery and guarantee blocks$desc_elite_trust$,
  $html_elite_trust$<div class="elite-wrapper">
  <div class="elite-header">
    <div class="elite-header-inner">
      <h1>{{title}}</h1>
    </div>
  </div>
  <div class="elite-main">
    {{#main_image}}<div class="elite-image-center"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    <div class="elite-container">
      <div class="elite-section">
        {{#product_description}}<div class="elite-prose-wrap"><h3>Product Overview</h3><div class="elite-prose">{{{product_description}}}</div></div>{{/product_description}}
        {{#has_features}}<div class="elite-features-wrap"><h3>Highlights</h3><ul class="elite-features">{{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
      </div>
      <div class="elite-policies">
        <div class="elite-policy-header">Buy with Confidence</div>
        <div class="elite-policy-item">
          <div class="elite-icon-wrap">&#128666;</div>
          <div class="elite-policy-content">
            <h4>Fast Handling</h4>
            <p>We process all orders within <strong>24-48 hours</strong> of payment confirmation.</p>
          </div>
        </div>
        <div class="elite-policy-item">
          <div class="elite-icon-wrap">&#128230;</div>
          <div class="elite-policy-content">
            <h4>Secure Delivery</h4>
            <p>Orders are shipped with premium tracking.</p>
          </div>
        </div>
        <div class="elite-policy-item">
          <div class="elite-icon-wrap">&#128737;</div>
          <div class="elite-policy-content">
            <h4>30-Day Guarantee</h4>
            <p>Not satisfied? Return within 30 days for a full refund.</p>
          </div>
        </div>
        <div class="elite-policy-item">
          <div class="elite-icon-wrap">&#11088;</div>
          <div class="elite-policy-content">
            <h4>Reliable Feedback</h4>
            <p>Our reputation is based on trust. Contact us first with any issues.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<style>
.elite-wrapper { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #fafafa; max-width: 960px; margin: 0 auto; color: #374151; line-height: 1.6; font-size: 15px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
.elite-wrapper img { max-width: 100%; height: auto; }
.elite-header { background: linear-gradient(135deg, #1f2937 0%, #111827 100%); color: #ffffff; padding: 48px 24px; text-align: center; border-bottom: 4px solid #3b82f6; }
.elite-header-inner { max-width: 800px; margin: 0 auto; }
.elite-header h1 { font-size: 28px; margin: 0; line-height: 1.4; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.elite-main { padding: 48px 32px; background: #ffffff; }
.elite-image-center { text-align: center; margin-bottom: 48px; padding: 24px; background: #f8fafc; border-radius: 12px; border: 1px solid #e5e7eb; }
.elite-image-center img { max-width: 600px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.elite-container { display: grid; grid-template-columns: 1fr 340px; gap: 48px; }
.elite-section h3 { font-size: 20px; font-weight: 700; margin: 0 0 16px 0; padding-bottom: 12px; border-bottom: 2px solid #f3f4f6; color: #111827; }
.elite-prose-wrap { margin-bottom: 32px; }
.elite-prose { margin: 0; color: #4b5563; font-size: 16px; }
.elite-features { padding: 0; margin: 0; list-style: none; }
.elite-features li { position: relative; padding-left: 28px; margin-bottom: 14px; color: #4b5563; }
.elite-features li::before { content: "\2713"; position: absolute; left: 0; top: 0; color: #10b981; font-weight: bold; font-size: 16px; }
.elite-policies { background: #f8fafc; padding: 32px; border-radius: 12px; border: 1px solid #e5e7eb; }
.elite-policy-header { font-size: 16px; font-weight: 700; color: #1f2937; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 24px; text-align: center; }
.elite-policy-item { display: flex; align-items: flex-start; margin-bottom: 24px; background: #ffffff; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #f3f4f6; }
.elite-policy-item:last-child { margin-bottom: 0; }
.elite-icon-wrap { font-size: 24px; margin-right: 16px; flex-shrink: 0; background: #f3f4f6; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
.elite-policy-content h4 { margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #111827; }
.elite-policy-content p { font-size: 13.5px; margin: 0; color: #6b7280; line-height: 1.5; }
@media (max-width: 768px) {
  .elite-wrapper { border-radius: 0; box-shadow: none; }
  .elite-header { padding: 32px 20px; }
  .elite-header h1 { font-size: 22px; }
  .elite-main { padding: 24px 20px; }
  .elite-container { grid-template-columns: 1fr; gap: 32px; }
  .elite-image-center img { max-width: 100%; }
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
-- 30. Spec Sheet
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
    <div class="zss-content-wrap">
      <div class="zss-left-col">
        {{#product_description}}<div class="zss-block"><h2 class="zss-h2">Overview</h2><div class="zss-prose">{{{product_description}}}</div></div>{{/product_description}}
        {{#has_features}}<div class="zss-block"><h2 class="zss-h2">Highlights</h2><ul class="zss-list">{{#feature_bullets}}<li class="zss-item">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
      </div>
      <div class="zss-right-col">
        {{#has_details}}<div class="zss-block zss-spec-block"><h2 class="zss-h2">Technical Specifications</h2><div class="zss-table-wrap"><table class="zss-table"><tbody>{{#product_details}}<tr><td class="zss-cell-bullet"></td><td class="zss-cell">{{.}}</td></tr>{{/product_details}}</tbody></table></div></div>{{/has_details}}
      </div>
    </div>
  </div>
</div>
<style>
.zss-root { font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #111827; line-height: 1.6; font-size: 15px; max-width: 1000px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
.zss-root img { max-width: 100%; height: auto; }
.zss-head { display: flex; flex-wrap: wrap; align-items: center; gap: 32px; background: #0f172a; color: #f8fafc; padding: 40px 32px; position: relative; overflow: hidden; }
.zss-head::before { content: ""; position: absolute; top: 0; right: 0; bottom: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05)); transform: skewX(-20deg); transform-origin: top right; }
.zss-head-main { flex: 1 1 400px; min-width: 0; position: relative; z-index: 1; }
.zss-head-media { flex: 0 0 200px; text-align: center; position: relative; z-index: 1; }
.zss-media-img { max-width: 200px; background: #ffffff; border-radius: 8px; padding: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
.zss-chips { margin-bottom: 16px; display: flex; gap: 8px; flex-wrap: wrap; }
.zss-chip { display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; background: #38bdf8; color: #020617; border-radius: 4px; padding: 6px 12px; }
.zss-chip-soft { background: rgba(255,255,255,0.1); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); }
.zss-title { font-size: 28px; font-weight: 700; line-height: 1.3; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
.zss-body { padding: 40px 32px; background: #f8fafc; }
.zss-content-wrap { display: flex; flex-wrap: wrap; gap: 40px; }
.zss-left-col { flex: 1.5 1 300px; }
.zss-right-col { flex: 1 1 300px; }
.zss-block { margin-bottom: 32px; background: #ffffff; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
.zss-spec-block { background: #1e293b; color: #f8fafc; border-color: #334155; }
.zss-spec-block .zss-h2 { color: #38bdf8; border-color: #334155; }
.zss-spec-block .zss-cell { color: #e2e8f0; border-color: #334155; }
.zss-spec-block .zss-table tr:nth-child(even) { background: rgba(255,255,255,0.03); }
.zss-h2 { font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #0f172a; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; }
.zss-prose { margin: 0; color: #475569; font-size: 15px; }
.zss-table-wrap { overflow-x: auto; }
.zss-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
.zss-table tr:nth-child(even) { background: #f8fafc; }
.zss-cell-bullet { width: 16px; padding: 12px 0 12px 12px; position: relative; }
.zss-cell-bullet::after { content: ""; position: absolute; top: 18px; left: 12px; width: 4px; height: 4px; background: #38bdf8; }
.zss-cell { padding: 12px 16px 12px 8px; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9; line-height: 1.5; }
.zss-list { list-style: none; margin: 0; padding: 0; }
.zss-item { position: relative; padding-left: 28px; margin-bottom: 12px; color: #475569; }
.zss-item::before { content: ""; position: absolute; left: 0; top: 7px; width: 16px; height: 16px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%230284c7'%3E%3Cpath fill-rule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clip-rule='evenodd'/%3E%3C/svg%3E"); background-size: cover; }
@media (max-width: 768px) {
  .zss-head { padding: 24px 20px; gap: 24px; text-align: center; }
  .zss-chips { justify-content: center; }
  .zss-head-media { flex: 1 1 100%; }
  .zss-title { font-size: 24px; }
  .zss-body { padding: 20px; }
  .zss-content-wrap { gap: 24px; }
  .zss-block { padding: 20px; }
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
-- 40. Gallery Grid
-- ---------------------------------------------------------------------------
(
  'gallery-grid',
  'Gallery Grid',
  $desc_gallery_grid$Photo-led layout that shows the complete image set beneath a large hero shot$desc_gallery_grid$,
  $html_gallery_grid$<div class="zgg-root">
  <div class="zgg-header">
    <h1 class="zgg-title">{{title}}</h1>
  </div>
  <div class="zgg-main">
    {{#main_image}}<div class="zgg-hero"><div class="zgg-hero-inner"><img class="zgg-hero-img" src="{{.}}" alt="{{title}}"></div></div>{{/main_image}}
    {{#has_images}}<div class="zgg-strip">{{#images}}<div class="zgg-cell"><img class="zgg-thumb" src="{{.}}" alt="{{title}}"></div>{{/images}}</div>{{/has_images}}
    <div class="zgg-content-grid">
      {{#product_description}}<div class="zgg-panel"><h2 class="zgg-h2">About this item</h2><div class="zgg-prose">{{{product_description}}}</div></div>{{/product_description}}
      {{#has_features}}<div class="zgg-panel"><h2 class="zgg-h2">Key features</h2><ul class="zgg-list">{{#feature_bullets}}<li class="zgg-item">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
    </div>
  </div>
</div>
<style>
.zgg-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #18181b; line-height: 1.6; font-size: 15px; max-width: 1024px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.04); border: 1px solid #f4f4f5; }
.zgg-root img { max-width: 100%; height: auto; display: block; }
.zgg-header { padding: 32px 40px; background: #fafafa; border-bottom: 1px solid #f4f4f5; text-align: center; }
.zgg-title { font-size: 28px; font-weight: 700; line-height: 1.3; margin: 0; color: #18181b; letter-spacing: -0.01em; }
.zgg-main { padding: 40px; }
.zgg-hero { background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; margin-bottom: 16px; display: flex; justify-content: center; }
.zgg-hero-inner { max-width: 600px; }
.zgg-hero-img { border-radius: 8px; object-fit: contain; max-height: 500px; }
.zgg-strip { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 40px; justify-content: center; }
.zgg-cell { flex: 0 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 8px; cursor: default; transition: border-color 0.2s, transform 0.2s; }
.zgg-cell:hover { border-color: #a1a1aa; transform: translateY(-2px); }
.zgg-thumb { width: 110px; height: 110px; object-fit: contain; border-radius: 6px; }
.zgg-content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
.zgg-panel { background: #fafafa; padding: 32px; border-radius: 16px; border: 1px solid #f4f4f5; }
.zgg-h2 { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; padding-bottom: 12px; border-bottom: 2px solid #e4e4e7; color: #09090b; }
.zgg-prose { margin: 0; color: #3f3f46; font-size: 15px; }
.zgg-list { list-style: none; margin: 0; padding: 0; }
.zgg-item { position: relative; padding-left: 24px; margin-bottom: 12px; color: #3f3f46; }
.zgg-item::before { content: "\2192"; position: absolute; left: 0; color: #a1a1aa; font-weight: bold; }
@media (max-width: 768px) {
  .zgg-header { padding: 24px 20px; }
  .zgg-title { font-size: 22px; }
  .zgg-main { padding: 20px; }
  .zgg-hero { padding: 16px; }
  .zgg-thumb { width: 80px; height: 80px; }
  .zgg-content-grid { grid-template-columns: 1fr; gap: 24px; }
  .zgg-panel { padding: 24px; }
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
-- 50. Minimal Mono
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
  <div class="zmm-body">
    {{#product_description}}<div class="zmm-block"><div class="zmm-label">Description</div><div class="zmm-prose">{{{product_description}}}</div></div>{{/product_description}}
    {{#has_features}}<div class="zmm-block"><div class="zmm-label">Features</div><ul class="zmm-list">{{#feature_bullets}}<li class="zmm-item">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
    {{#has_details}}<div class="zmm-block zmm-block-last"><div class="zmm-label">Details</div><ul class="zmm-cols">{{#product_details}}<li class="zmm-col-item">{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
  </div>
</div>
<style>
.zmm-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1c1917; line-height: 1.8; font-size: 16px; max-width: 800px; margin: 0 auto; padding: 48px 40px; background: #fafaf9; border-top: 8px solid #292524; }
.zmm-head { padding-bottom: 32px; border-bottom: 1px solid #e7e5e4; margin-bottom: 40px; }
.zmm-eyebrow { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase; color: #78716c; margin-bottom: 12px; }
.zmm-title { font-size: 32px; font-weight: 700; line-height: 1.25; margin: 0; color: #1c1917; letter-spacing: -0.02em; }
.zmm-block { margin-bottom: 48px; }
.zmm-block-last { margin-bottom: 0; }
.zmm-label { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #a8a29e; margin-bottom: 16px; display: flex; align-items: center; }
.zmm-label::after { content: ""; flex: 1; height: 1px; background: #e7e5e4; margin-left: 16px; }
.zmm-prose { margin: 0; color: #292524; font-size: 17px; max-width: 680px; }
.zmm-list { list-style: none; margin: 0; padding: 0; max-width: 680px; }
.zmm-item { position: relative; padding-left: 24px; margin-bottom: 12px; color: #44403c; }
.zmm-item::before { content: "\2014"; position: absolute; left: 0; color: #d6d3d1; font-weight: bold; }
.zmm-cols { list-style: none; margin: 0; padding: 0; column-count: 2; column-gap: 48px; }
.zmm-col-item { font-size: 15px; color: #57534e; padding: 10px 0; border-bottom: 1px solid #f5f5f4; break-inside: avoid; }
@media (max-width: 768px) {
  .zmm-root { padding: 32px 20px; border-top-width: 4px; }
  .zmm-title { font-size: 26px; }
  .zmm-cols { column-count: 1; }
  .zmm-block { margin-bottom: 32px; }
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
-- 60. Boutique Card
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
.zbc-stage { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #fbf9f6; padding: 48px 20px; line-height: 1.7; font-size: 15px; color: #43342a; }
.zbc-card { max-width: 860px; margin: 0 auto; background: #ffffff; border: 1px solid #f0e9e1; border-radius: 2px; padding: 56px 48px; box-shadow: 0 10px 30px -10px rgba(107,84,67,0.1); }
.zbc-card img { max-width: 100%; height: auto; }
.zbc-head { text-align: center; margin-bottom: 40px; }
.zbc-brand { font-size: 13px; font-weight: 600; letter-spacing: 0.25em; text-transform: uppercase; color: #b8977e; margin-bottom: 16px; }
.zbc-title { font-family: "Playfair Display", Georgia, Cambria, "Times New Roman", Times, serif; font-size: 32px; font-weight: 400; line-height: 1.35; margin: 0; color: #2d2019; }
.zbc-rule { width: 40px; height: 1px; background: #d8bfa4; margin: 24px auto 0 auto; }
.zbc-media { text-align: center; margin-bottom: 40px; position: relative; padding: 12px; }
.zbc-media::before { content: ""; position: absolute; top: 0; left: 10%; right: 10%; bottom: 0; border: 1px solid #f0e9e1; z-index: 0; pointer-events: none; }
.zbc-img { max-width: 500px; position: relative; z-index: 1; box-shadow: 0 8px 20px rgba(0,0,0,0.06); }
.zbc-prose { margin: 0 auto 36px auto; max-width: 680px; text-align: center; color: #5b4636; font-size: 16px; font-style: italic; font-family: Georgia, serif; }
.zbc-chips { text-align: center; margin-bottom: 48px; }
.zbc-chip { display: inline-block; background: #ffffff; border: 1px solid #e9ded1; border-radius: 2px; padding: 8px 20px; margin: 0 8px 12px 0; font-size: 13px; color: #6b5443; transition: background-color 0.3s; letter-spacing: 0.05em; }
.zbc-glance { background: #faf7f2; border: 1px solid #f0e9e1; border-radius: 2px; padding: 32px; text-align: center; }
.zbc-glance-label { font-family: "Playfair Display", Georgia, Cambria, "Times New Roman", Times, serif; font-size: 20px; color: #3a2b21; margin-bottom: 20px; text-align: center; font-style: italic; }
.zbc-glance-list { list-style: none; margin: 0 auto; padding: 0; max-width: 500px; }
.zbc-glance-item { font-size: 14px; color: #6b5443; padding: 12px 0; border-bottom: 1px dashed #e4dcd3; }
.zbc-glance-item:last-child { border-bottom: none; padding-bottom: 0; }
@media (max-width: 768px) {
  .zbc-stage { padding: 24px 12px; }
  .zbc-card { padding: 32px 24px; }
  .zbc-title { font-size: 26px; }
  .zbc-media::before { left: 0; right: 0; }
  .zbc-glance { padding: 24px 16px; }
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
-- 70. Compact Mobile
-- ---------------------------------------------------------------------------
(
  'compact-mobile',
  'Compact Mobile',
  $desc_compact_mobile$Single-column layout tuned for the eBay mobile app, with features shown first$desc_compact_mobile$,
  $html_compact_mobile$<div class="zcm-root">
  <h1 class="zcm-title">{{title}}</h1>
  {{#main_image}}<div class="zcm-media"><img class="zcm-img" src="{{.}}" alt="{{title}}"></div>{{/main_image}}
  {{#has_features}}<div class="zcm-feature-card"><ul class="zcm-list">{{#feature_bullets}}<li class="zcm-item">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
  {{#product_description}}<div class="zcm-block"><h2 class="zcm-h2">Description</h2><div class="zcm-prose">{{{product_description}}}</div></div>{{/product_description}}
  {{#has_details}}<div class="zcm-block"><h2 class="zcm-h2">Details</h2><ul class="zcm-rows">{{#product_details}}<li class="zcm-row">{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
  <div class="zcm-assure">
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128230;</div><div class="zcm-assure-text">Carefully packed</div></div>
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128666;</div><div class="zcm-assure-text">Tracked delivery</div></div>
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128737;</div><div class="zcm-assure-text">Returns accepted</div></div>
    <div class="zcm-assure-cell"><div class="zcm-assure-icon">&#128172;</div><div class="zcm-assure-text">Message anytime</div></div>
  </div>
</div>
<style>
.zcm-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #0f172a; line-height: 1.6; font-size: 16px; max-width: 640px; margin: 0 auto; padding: 24px 20px; background: #f8fafc; }
.zcm-root img { max-width: 100%; height: auto; }
.zcm-title { font-size: 26px; font-weight: 800; line-height: 1.3; margin: 0 0 24px 0; color: #0f172a; }
.zcm-media { text-align: center; margin-bottom: 24px; background: #ffffff; padding: 16px; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.zcm-img { max-width: 100%; border-radius: 8px; }
.zcm-feature-card { background: #ffffff; border-radius: 16px; padding: 20px; margin-bottom: 28px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); border-left: 4px solid #3b82f6; }
.zcm-list { list-style: none; margin: 0; padding: 0; }
.zcm-item { position: relative; padding: 12px 0 12px 32px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color: #334155; }
.zcm-item:last-child { border-bottom: none; padding-bottom: 0; }
.zcm-item:first-child { padding-top: 0; }
.zcm-item::before { content: "\2713"; position: absolute; left: 0; top: 12px; color: #16a34a; font-weight: 900; font-size: 18px; }
.zcm-item:first-child::before { top: 0; }
.zcm-block { margin-bottom: 28px; background: #ffffff; padding: 24px; border-radius: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.zcm-h2 { font-size: 14px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #64748b; margin: 0 0 16px 0; }
.zcm-prose { margin: 0; color: #475569; }
.zcm-rows { list-style: none; margin: 0; padding: 0; }
.zcm-row { font-size: 15px; color: #475569; padding: 12px 0; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; }
.zcm-row:last-child { border-bottom: none; padding-bottom: 0; }
.zcm-assure { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 32px; }
.zcm-assure-cell { background: #ffffff; padding: 16px; border-radius: 12px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; flex-direction: column; align-items: center; justify-content: center; }
.zcm-assure-icon { font-size: 28px; line-height: 1; margin-bottom: 8px; }
.zcm-assure-text { font-size: 13px; font-weight: 600; color: #64748b; }
@media (max-width: 400px) {
  .zcm-root { padding: 16px 12px; }
  .zcm-title { font-size: 22px; }
  .zcm-assure { grid-template-columns: 1fr 1fr; }
}
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
-- 80. Brand Story
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
  <div class="zbs-content-area">
    {{#main_image}}<div class="zbs-media"><img class="zbs-img" src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    <div class="zbs-info-side">
      {{#product_description}}<div class="zbs-quote"><div class="zbs-quote-mark">"</div><div class="zbs-prose">{{{product_description}}}</div></div>{{/product_description}}
      {{#has_features}}<div class="zbs-section"><h2 class="zbs-h2">What you get</h2><ul class="zbs-grid">{{#feature_bullets}}<li class="zbs-cell">{{.}}</li>{{/feature_bullets}}</ul></div>{{/has_features}}
    </div>
  </div>
  {{#has_details}}<div class="zbs-footer"><h2 class="zbs-h2 zbs-h2-muted">Specifications</h2><ul class="zbs-rows">{{#product_details}}<li class="zbs-row">{{.}}</li>{{/product_details}}</ul></div>{{/has_details}}
</div>
<style>
.zbs-root { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #1a202c; line-height: 1.7; font-size: 15px; max-width: 960px; margin: 0 auto; padding: 48px; background: #ffffff; border: 1px solid #edf2f7; border-radius: 8px; }
.zbs-root img { max-width: 100%; height: auto; }
.zbs-masthead { text-align: center; margin-bottom: 48px; position: relative; }
.zbs-brand { font-size: 13px; font-weight: 700; letter-spacing: 0.35em; text-transform: uppercase; color: #047857; margin-bottom: 16px; display: inline-block; padding-bottom: 8px; border-bottom: 2px solid #047857; }
.zbs-title { font-size: 32px; font-weight: 300; line-height: 1.3; margin: 0; color: #1a202c; letter-spacing: -0.01em; }
.zbs-content-area { display: flex; flex-wrap: wrap; gap: 48px; margin-bottom: 48px; align-items: center; }
.zbs-media { flex: 1 1 360px; text-align: center; }
.zbs-img { max-width: 100%; border-radius: 4px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
.zbs-info-side { flex: 1.2 1 360px; }
.zbs-quote { background: #f0fdf4; border-radius: 8px; padding: 32px 40px; margin-bottom: 40px; position: relative; }
.zbs-quote-mark { position: absolute; top: -10px; left: 16px; font-size: 60px; color: #d1fae5; font-family: Georgia, serif; font-weight: bold; line-height: 1; pointer-events: none; }
.zbs-prose { margin: 0; font-size: 17px; color: #065f46; position: relative; z-index: 1; font-style: italic; }
.zbs-section { margin-bottom: 0; }
.zbs-h2 { font-size: 14px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #047857; margin: 0 0 20px 0; }
.zbs-h2-muted { color: #a0aec0; border-bottom: 1px solid #edf2f7; padding-bottom: 12px; }
.zbs-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; }
.zbs-cell { position: relative; padding-left: 24px; color: #4a5568; font-weight: 500; }
.zbs-cell::before { content: "\25A0"; position: absolute; left: 0; top: 0; font-size: 10px; line-height: 2.4; color: #34d399; }
.zbs-footer { border-top: 1px solid #edf2f7; padding-top: 40px; }
.zbs-rows { list-style: none; margin: 0; padding: 0; column-count: 2; column-gap: 40px; }
.zbs-row { font-size: 14px; color: #718096; padding: 10px 0; border-bottom: 1px solid #f7fafc; break-inside: avoid; }
@media (max-width: 768px) {
  .zbs-root { padding: 32px 20px; }
  .zbs-title { font-size: 26px; }
  .zbs-content-area { gap: 32px; }
  .zbs-quote { padding: 24px; }
  .zbs-grid { grid-template-columns: 1fr; }
  .zbs-rows { column-count: 1; }
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
),

-- ---------------------------------------------------------------------------
-- 90. Neon Gamer (NEW)
-- ---------------------------------------------------------------------------
(
  'neon-gamer',
  'Neon Gamer',
  $desc_neon_gamer$Dark mode layout with vibrant neon accents and technical styling for gaming and PC gear$desc_neon_gamer$,
  $html_neon_gamer$<div class="zng-root">
  <div class="zng-header">
    <div class="zng-glitch" data-text="{{title}}">{{title}}</div>
    {{#brand}}<div class="zng-brand">BY {{.}}</div>{{/brand}}
  </div>
  
  <div class="zng-container">
    {{#main_image}}<div class="zng-media"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="zng-details">
      {{#has_features}}<div class="zng-box">
        <h2 class="zng-title-bar">/// CORE_SPECS</h2>
        <ul class="zng-list">
          {{#feature_bullets}}<li><span class="zng-bullet">&gt;</span> {{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#product_description}}<div class="zng-box zng-desc-box">
        <h2 class="zng-title-bar">/// MISSION_BRIEF</h2>
        <div class="zng-prose">{{{product_description}}}</div>
      </div>{{/product_description}}
    </div>
  </div>
  
  {{#has_details}}<div class="zng-tech-table">
    <h2 class="zng-title-bar">/// TECH_DATA</h2>
    <div class="zng-grid">
      {{#product_details}}<div class="zng-grid-item">{{.}}</div>{{/product_details}}
    </div>
  </div>{{/has_details}}
</div>
<style>
.zng-root { font-family: "Segoe UI", Roboto, "Helvetica Neue", sans-serif; background: #0f0f13; color: #e2e8f0; max-width: 960px; margin: 0 auto; padding: 30px; font-size: 15px; border: 1px solid #27272a; border-radius: 8px; box-shadow: 0 0 40px rgba(6, 182, 212, 0.05); }
.zng-root img { max-width: 100%; height: auto; }
.zng-header { text-align: center; margin-bottom: 40px; border-bottom: 1px solid #27272a; padding-bottom: 30px; position: relative; }
.zng-header::after { content: ""; position: absolute; bottom: -1px; left: 50%; transform: translateX(-50%); width: 100px; height: 2px; background: #06b6d4; box-shadow: 0 0 10px #06b6d4; }
.zng-glitch { font-size: 32px; font-weight: 900; color: #fff; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; text-shadow: 0 0 10px rgba(255,255,255,0.2); }
.zng-brand { font-family: "Courier New", Courier, monospace; color: #06b6d4; font-size: 14px; letter-spacing: 4px; font-weight: bold; }
.zng-container { display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 40px; }
.zng-media { flex: 1 1 400px; background: #18181b; border: 1px solid #27272a; padding: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center; position: relative; }
.zng-media::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(45deg, transparent 95%, rgba(6, 182, 212, 0.2) 100%); pointer-events: none; }
.zng-media img { border-radius: 4px; mix-blend-mode: screen; }
.zng-details { flex: 1 1 400px; display: flex; flex-direction: column; gap: 20px; }
.zng-box { background: rgba(24, 24, 27, 0.5); border: 1px solid #27272a; border-left: 3px solid #06b6d4; padding: 20px; }
.zng-title-bar { font-family: "Courier New", Courier, monospace; font-size: 14px; color: #06b6d4; margin: 0 0 16px 0; letter-spacing: 1px; font-weight: bold; }
.zng-list { list-style: none; padding: 0; margin: 0; }
.zng-list li { margin-bottom: 12px; color: #cbd5e1; display: flex; }
.zng-bullet { color: #ec4899; margin-right: 10px; font-weight: bold; }
.zng-desc-box { border-left-color: #ec4899; }
.zng-desc-box .zng-title-bar { color: #ec4899; }
.zng-prose { color: #94a3b8; line-height: 1.6; }
.zng-tech-table { background: #18181b; padding: 24px; border: 1px solid #27272a; border-radius: 4px; }
.zng-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.zng-grid-item { background: #0f0f13; padding: 10px 16px; font-family: "Courier New", Courier, monospace; font-size: 13px; color: #cbd5e1; border: 1px solid #27272a; border-left: 2px solid #3b82f6; }
@media (max-width: 768px) {
  .zng-root { padding: 16px; }
  .zng-glitch { font-size: 24px; }
  .zng-container { gap: 20px; }
}
</style>$html_neon_gamer$,
  $json_neon_gamer${
      "brand": "Razer",
      "title": "BlackWidow V3 Mechanical Gaming Keyboard - Green Switch",
      "main_image": "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=900",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Razer Green Mechanical Switches",
          "Transparent switch housing for brighter Razer Chroma RGB",
          "Doubleshot ABS keycaps",
          "Multi-function digital roller and media key",
          "Ergonomic wrist rest"
      ],
      "product_details": [
          "Switch Type: Tactile and Clicky",
          "Lighting: Razer Chroma RGB",
          "Connectivity: Wired",
          "Keycaps: Doubleshot ABS",
          "Wrist Rest: Yes",
          "Cable Routing: Yes"
      ],
      "product_description": "Feel the difference with the Razer BlackWidow V3. Featuring an improved mechanical switch design and transparent housing for vibrant RGB lighting."
  }$json_neon_gamer$::jsonb,
  90,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 100. Vintage Craft (NEW)
-- ---------------------------------------------------------------------------
(
  'vintage-craft',
  'Vintage Craft',
  $desc_vintage_craft$Rustic, textured layout with classic serif typography for handmade, vintage, and artisan goods$desc_vintage_craft$,
  $html_vintage_craft$<div class="zvc-wrapper">
  <div class="zvc-border-inner">
    <div class="zvc-header">
      {{#brand}}<div class="zvc-maker">CRAFTED BY {{.}}</div>{{/brand}}
      <h1 class="zvc-title">{{title}}</h1>
      <div class="zvc-divider">&#10086;</div>
    </div>
    
    <div class="zvc-content">
      {{#main_image}}<div class="zvc-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
      
      {{#product_description}}<div class="zvc-story">
        <h2 class="zvc-heading">The Story</h2>
        <div class="zvc-prose">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      <div class="zvc-specs-row">
        {{#has_features}}<div class="zvc-column">
          <h2 class="zvc-heading">Highlights</h2>
          <ul class="zvc-list">
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
        
        {{#has_details}}<div class="zvc-column">
          <h2 class="zvc-heading">Particulars</h2>
          <ul class="zvc-details">
            {{#product_details}}<li>{{.}}</li>{{/product_details}}
          </ul>
        </div>{{/has_details}}
      </div>
    </div>
  </div>
</div>
<style>
.zvc-wrapper { background-color: #f4eee1; padding: 24px; max-width: 860px; margin: 0 auto; color: #3e3328; font-family: "Palatino Linotype", "Book Antiqua", Palatino, serif; box-shadow: 0 4px 15px rgba(0,0,0,0.08); background-image: radial-gradient(#e4dac0 1px, transparent 1px); background-size: 20px 20px; }
.zvc-wrapper img { max-width: 100%; height: auto; }
.zvc-border-inner { border: 2px solid #8c765f; padding: 40px; background-color: #f9f6f0; }
.zvc-header { text-align: center; margin-bottom: 40px; }
.zvc-maker { font-family: "Courier New", Courier, monospace; font-size: 13px; letter-spacing: 2px; color: #8c765f; margin-bottom: 12px; text-transform: uppercase; }
.zvc-title { font-size: 32px; font-weight: normal; margin: 0 0 20px 0; color: #2d241b; line-height: 1.2; }
.zvc-divider { color: #8c765f; font-size: 24px; }
.zvc-image { text-align: center; margin-bottom: 40px; border: 8px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: inline-block; width: 100%; }
.zvc-image img { display: block; width: 100%; }
.zvc-heading { font-size: 18px; text-align: center; text-transform: uppercase; letter-spacing: 2px; color: #2d241b; border-bottom: 1px solid #d4c5b3; padding-bottom: 10px; margin-bottom: 20px; }
.zvc-story { text-align: center; margin-bottom: 40px; max-width: 600px; margin-left: auto; margin-right: auto; }
.zvc-prose { font-size: 17px; line-height: 1.8; color: #4a3e31; font-style: italic; }
.zvc-specs-row { display: flex; flex-wrap: wrap; gap: 40px; }
.zvc-column { flex: 1 1 300px; }
.zvc-list, .zvc-details { list-style: none; padding: 0; margin: 0; }
.zvc-list li { margin-bottom: 12px; padding-left: 24px; position: relative; line-height: 1.5; font-size: 16px; }
.zvc-list li::before { content: "\2740"; position: absolute; left: 0; color: #8c765f; font-size: 12px; top: 2px; }
.zvc-details li { margin-bottom: 12px; padding: 10px 0; border-bottom: 1px dotted #d4c5b3; font-size: 15px; }
.zvc-details li:last-child { border-bottom: none; }
@media (max-width: 768px) {
  .zvc-wrapper { padding: 12px; }
  .zvc-border-inner { padding: 20px; }
  .zvc-title { font-size: 26px; }
}
</style>$html_vintage_craft$,
  $json_vintage_craft${
      "brand": "Heritage Leather Co.",
      "title": "Handcrafted Full Grain Leather Satchel Messenger Bag",
      "main_image": "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=900",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Vegetable-tanned full grain cowhide",
          "Solid brass hardware with antique finish",
          "Hand-stitched with waxed thread",
          "Develops a rich patina over time",
          "Fits up to a 15-inch laptop"
      ],
      "product_details": [
          "Dimensions: 16\" x 12\" x 4\"",
          "Weight: 3.2 lbs",
          "Color: Vintage Brown",
          "Origin: Handcrafted in Italy",
          "Strap: Adjustable, 45-55 inches"
      ],
      "product_description": "Each satchel is individually cut, dyed, and sewn by master artisans. The natural variations in the leather mean no two bags are exactly alike, telling a unique story that evolves with your daily journeys."
  }$json_vintage_craft$::jsonb,
  100,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 110. Auto Parts Pro (NEW)
-- ---------------------------------------------------------------------------
(
  'auto-parts-pro',
  'Auto Parts Pro',
  $desc_auto_parts_pro$High-contrast, highly structured layout emphasizing part numbers and compatibility for automotive$desc_auto_parts_pro$,
  $html_auto_parts_pro$<div class="zap-root">
  <div class="zap-header">
    <div class="zap-brand-wrap">
      {{#brand}}<span class="zap-brand">{{.}}</span>{{/brand}}
      <span class="zap-badge">PREMIUM REPLACEMENT</span>
    </div>
    <h1 class="zap-title">{{title}}</h1>
  </div>
  
  <div class="zap-content">
    {{#main_image}}<div class="zap-image-panel"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="zap-specs-panel">
      {{#product_description}}<div class="zap-desc">
        <h3>COMPONENT OVERVIEW</h3>
        <div class="zap-prose">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="zap-features">
        <h3>KEY ADVANTAGES</h3>
        <ul class="zap-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
    </div>
  </div>
  
  {{#has_details}}<div class="zap-tech-specs">
    <h3>TECHNICAL SPECIFICATIONS</h3>
    <table class="zap-table">
      <tbody>
        {{#product_details}}<tr><td class="zap-td-icon">&#9881;</td><td class="zap-td">{{.}}</td></tr>{{/product_details}}
      </tbody>
    </table>
  </div>{{/has_details}}
  
  <div class="zap-footer">
    <div class="zap-footer-item"><strong>&#10003; EXACT FIT</strong> GUARANTEED</div>
    <div class="zap-footer-item"><strong>&#9874; DURABILITY</strong> TESTED</div>
    <div class="zap-footer-item"><strong>&#128663; FAST</strong> SHIPPING</div>
  </div>
</div>
<style>
.zap-root { font-family: "Arial Black", Arial, sans-serif; background: #ffffff; max-width: 1000px; margin: 0 auto; border: 2px solid #000; box-shadow: 6px 6px 0px #e11d48; color: #111; font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; }
.zap-root img { max-width: 100%; height: auto; }
.zap-header { background: #111; color: #fff; padding: 30px; border-bottom: 5px solid #e11d48; }
.zap-brand-wrap { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.zap-brand { font-size: 20px; font-weight: 900; color: #fff; text-transform: uppercase; font-family: "Arial Black", sans-serif; letter-spacing: 1px; }
.zap-badge { background: #e11d48; color: #fff; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 2px; }
.zap-title { font-size: 26px; font-weight: 800; margin: 0; line-height: 1.2; }
.zap-content { display: flex; flex-wrap: wrap; }
.zap-image-panel { flex: 1 1 400px; padding: 40px; border-right: 2px solid #eee; display: flex; align-items: center; justify-content: center; background: #f9f9f9; }
.zap-image-panel img { max-width: 100%; mix-blend-mode: multiply; }
.zap-specs-panel { flex: 1 1 350px; padding: 30px; }
.zap-specs-panel h3, .zap-tech-specs h3 { font-family: "Arial Black", sans-serif; font-size: 16px; margin: 0 0 15px 0; color: #111; border-left: 5px solid #e11d48; padding-left: 10px; text-transform: uppercase; }
.zap-desc { margin-bottom: 30px; }
.zap-prose { font-size: 15px; line-height: 1.6; color: #444; }
.zap-list { list-style: none; padding: 0; margin: 0; }
.zap-list li { padding: 10px 0 10px 25px; border-bottom: 1px solid #eee; position: relative; font-weight: 600; color: #222; }
.zap-list li::before { content: "\25BA"; position: absolute; left: 0; color: #e11d48; font-size: 12px; top: 12px; }
.zap-tech-specs { padding: 30px; background: #f4f4f5; border-top: 2px solid #eee; }
.zap-table { width: 100%; border-collapse: collapse; }
.zap-table tr { background: #fff; border-bottom: 2px solid #f4f4f5; }
.zap-td-icon { width: 30px; text-align: center; color: #71717a; font-size: 18px; padding: 12px 0; }
.zap-td { padding: 12px 15px; font-weight: 600; color: #3f3f46; font-size: 14px; }
.zap-footer { display: flex; flex-wrap: wrap; background: #111; color: #fff; }
.zap-footer-item { flex: 1 1 200px; text-align: center; padding: 20px; font-size: 14px; border-right: 1px solid #333; }
.zap-footer-item:last-child { border-right: none; }
.zap-footer-item strong { color: #e11d48; }
@media (max-width: 768px) {
  .zap-root { box-shadow: 4px 4px 0px #e11d48; }
  .zap-image-panel { border-right: none; border-bottom: 2px solid #eee; padding: 20px; }
  .zap-brand-wrap { flex-direction: column; align-items: flex-start; gap: 10px; }
}
</style>$html_auto_parts_pro$,
  $json_auto_parts_pro${
      "brand": "Bosch",
      "title": "Premium Ceramic Disc Brake Pad Set - Front",
      "main_image": "https://images.unsplash.com/photo-1600705606132-73a7029bc489?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Advanced aerospace alloy copper-free ceramic friction formula",
          "Protective transfer layer extends pad and rotor life",
          "Quiet operation with multi-layer shim",
          "Includes hardware kit and synthetic lubricant"
      ],
      "product_details": [
          "Part Number: BC1234",
          "Position: Front",
          "Material: Ceramic",
          "Hardware Included: Yes",
          "Fitment: 2015-2022 Honda Accord",
          "Warranty: 1 Year Limited"
      ],
      "product_description": "Engineered for superior stopping power and ultra-quiet operation. These premium ceramic brake pads feature a multi-layer shim for noise dampening and come completely ready for installation."
  }$json_auto_parts_pro$::jsonb,
  110,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 120. Luxury Gold (NEW)
-- ---------------------------------------------------------------------------
(
  'luxury-gold',
  'Luxury Gold',
  $desc_luxury_gold$Ultra-minimalist premium layout with wide spacing, elegant serif typography and gold accents$desc_luxury_gold$,
  $html_luxury_gold$<div class="zlg-body">
  <div class="zlg-container">
    <div class="zlg-header">
      {{#brand}}<div class="zlg-brand">{{.}}</div>{{/brand}}
      <h1 class="zlg-title">{{title}}</h1>
    </div>
    
    {{#main_image}}<div class="zlg-hero">
      <img src="{{.}}" alt="{{title}}">
    </div>{{/main_image}}
    
    <div class="zlg-content-wrapper">
      {{#product_description}}<div class="zlg-section zlg-description">
        <div class="zlg-prose">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      <div class="zlg-grid">
        {{#has_features}}<div class="zlg-grid-col">
          <h2 class="zlg-heading">The Details</h2>
          <ul class="zlg-list">
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
        
        {{#has_details}}<div class="zlg-grid-col">
          <h2 class="zlg-heading">Specifications</h2>
          <ul class="zlg-list">
            {{#product_details}}<li>{{.}}</li>{{/product_details}}
          </ul>
        </div>{{/has_details}}
      </div>
    </div>
    
    <div class="zlg-footer">
      <p>AUTHENTICITY GUARANTEED &middot; COMPLIMENTARY SHIPPING &middot; SECURE PACKAGING</p>
    </div>
  </div>
</div>
<style>
.zlg-body { font-family: "Optima", "Didot", "Bodoni MT", serif; background-color: #000000; color: #ffffff; padding: 40px 20px; line-height: 1.8; }
.zlg-body img { max-width: 100%; height: auto; }
.zlg-container { max-width: 900px; margin: 0 auto; }
.zlg-header { text-align: center; margin-bottom: 50px; }
.zlg-brand { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 11px; letter-spacing: 0.4em; text-transform: uppercase; color: #d4af37; margin-bottom: 20px; }
.zlg-title { font-size: 36px; font-weight: normal; margin: 0; color: #ffffff; line-height: 1.3; }
.zlg-hero { text-align: center; margin-bottom: 60px; padding: 40px; background: radial-gradient(circle, #1a1a1a 0%, #000000 100%); border: 1px solid #1a1a1a; }
.zlg-hero img { max-width: 600px; display: inline-block; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5)); }
.zlg-content-wrapper { max-width: 700px; margin: 0 auto; }
.zlg-description { text-align: center; margin-bottom: 60px; position: relative; padding-bottom: 40px; }
.zlg-description::after { content: ""; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 40px; height: 1px; background-color: #d4af37; }
.zlg-prose { font-size: 18px; color: #cccccc; font-style: italic; }
.zlg-grid { display: flex; flex-wrap: wrap; gap: 60px; margin-bottom: 60px; }
.zlg-grid-col { flex: 1 1 250px; }
.zlg-heading { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 10px; letter-spacing: 0.3em; text-transform: uppercase; color: #d4af37; margin: 0 0 24px 0; border-bottom: 1px solid #1a1a1a; padding-bottom: 12px; }
.zlg-list { list-style: none; padding: 0; margin: 0; }
.zlg-list li { margin-bottom: 16px; font-size: 15px; color: #a3a3a3; position: relative; padding-left: 20px; }
.zlg-list li::before { content: "\2022"; position: absolute; left: 0; color: #d4af37; }
.zlg-footer { text-align: center; border-top: 1px solid #1a1a1a; padding-top: 30px; }
.zlg-footer p { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 0.2em; color: #666666; margin: 0; }
@media (max-width: 768px) {
  .zlg-body { padding: 20px 10px; }
  .zlg-title { font-size: 28px; }
  .zlg-hero { padding: 20px; }
  .zlg-grid { gap: 40px; }
}
</style>$html_luxury_gold$,
  $json_luxury_gold${
      "brand": "Maison Horlogerie",
      "title": "Automatic Chronograph Mens Watch - 42mm Sapphire Crystal",
      "main_image": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Swiss Automatic Movement",
          "Scratch-resistant Sapphire Crystal",
          "316L Surgical Grade Stainless Steel",
          "Water resistant to 100 meters",
          "Exhibition case back"
      ],
      "product_details": [
          "Case Diameter: 42mm",
          "Case Thickness: 13.5mm",
          "Dial Color: Midnight Blue",
          "Strap: Genuine Alligator Leather",
          "Power Reserve: 48 Hours"
      ],
      "product_description": "A masterpiece of timekeeping. Meticulously assembled by master watchmakers, this chronograph combines timeless elegance with unparalleled mechanical precision."
  }$json_luxury_gold$::jsonb,
  120,
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
