-- apps/api/migrations/127_dropshipping_templates_catalog_more.sql
-- Adds 8 new categorized dropshipping templates for specific market segments.

INSERT INTO predefined_templates (slug, name, description, html_content, sample_data, sort_order, is_active) VALUES

(
  'tools-home-improvement',
  'Tools & Home Improvement',
  $desc_tools_home_improvement$Rugged and industrial layout focused on specifications and durability for tools and hardware.$desc_tools_home_improvement$,
  $html_tools_home_improvement$
<div class="sh-tools-wrap">
  <div class="sh-tools-header">
    <div class="sh-tools-accent"></div>
    <h1>{{title}}</h1>
    <div class="sh-tools-badges">
      <span>HEAVY DUTY</span>
      <span>PRO GRADE</span>
    </div>
  </div>
  <div class="sh-tools-grid">
    {{#main_image}}<div class="sh-tools-image-pane"><img src="{{.}}" alt="Product Image"></div>{{/main_image}}
    <div class="sh-tools-info-pane">
      {{#product_description}}<div class="sh-tools-desc">
        <h3>Overview</h3>
        <p>{{{product_description}}}</p>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-tools-features">
        <h3>Key Specs</h3>
        <ul>
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
    </div>
  </div>
  {{#has_details}}<div class="sh-tools-details">
    <h3>Technical Details</h3>
    <table>
      <tbody>
        {{#product_details}}<tr><td>{{.}}</td></tr>{{/product_details}}
      </tbody>
    </table>
  </div>{{/has_details}}
</div>

<style>

.sh-tools-wrap { max-width: 960px; margin: 0 auto; font-family: Impact, "Arial Black", sans-serif; background: #fff; color: #222; border: 4px solid #222; }
.sh-tools-header { position: relative; padding: 30px; background: #111; color: #fff; text-transform: uppercase; }
.sh-tools-accent { position: absolute; top: 0; left: 0; width: 100%; height: 8px; background: #fbbf24; }
.sh-tools-header h1 { margin: 0 0 15px 0; font-size: 32px; letter-spacing: 1px; }
.sh-tools-badges span { display: inline-block; background: #fbbf24; color: #111; padding: 4px 12px; margin-right: 10px; font-size: 14px; transform: skew(-10deg); }
.sh-tools-grid { display: flex; flex-wrap: wrap; border-bottom: 4px solid #222; }
.sh-tools-image-pane { flex: 1 1 400px; padding: 20px; border-right: 4px solid #222; }
.sh-tools-image-pane img { width: 100%; height: auto; border: 2px solid #ddd; }
.sh-tools-info-pane { flex: 1.5 1 400px; padding: 30px; font-family: Arial, sans-serif; }
.sh-tools-desc h3, .sh-tools-features h3, .sh-tools-details h3 { font-family: Impact, "Arial Black", sans-serif; text-transform: uppercase; font-size: 22px; border-bottom: 3px solid #fbbf24; padding-bottom: 5px; margin-top: 0; }
.sh-tools-desc p { line-height: 1.6; font-size: 16px; }
.sh-tools-features ul { list-style: none; padding: 0; }
.sh-tools-features li { padding: 8px 0 8px 25px; position: relative; font-weight: bold; border-bottom: 1px solid #eee; }
.sh-tools-features li::before { content: "►"; position: absolute; left: 0; color: #fbbf24; }
.sh-tools-details { padding: 30px; font-family: Arial, sans-serif; background: #f9fafb; }
.sh-tools-details table { width: 100%; border-collapse: collapse; }
.sh-tools-details td { padding: 12px; border: 1px solid #ddd; font-weight: bold; }
.sh-tools-details tr:nth-child(even) { background: #eee; }
@media(max-width: 768px) { .sh-tools-image-pane { border-right: none; border-bottom: 4px solid #222; } }
</style>$html_tools_home_improvement$,
  $json_tools_home_improvement${
    "title": "High-Torque Cordless Power Drill 20V Max",
    "main_image": "/template-samples/tools-home-improvement.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "Brushless motor for extended runtime",
        "2-speed transmission (0-600 / 0-2000 RPM)",
        "Compact, lightweight design fits into tight areas",
        "Heavy-duty 1/2-inch ratcheting chuck"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Voltage: 20V",
        "Power Source: Battery",
        "Chuck Size: 1/2 in"
    ],
    "product_description": "Tackle the toughest jobs with this 20V Max high-torque cordless drill. Featuring a brushless motor for increased power and durability, it delivers the performance needed for heavy-duty applications."
}$json_tools_home_improvement$::jsonb,
  170,
  TRUE
),

(
  'electronics-pro',
  'Electronics Pro',
  $desc_electronics_pro$Dark mode, high-contrast, ultra-modern layout for premium tech and audio gadgets.$desc_electronics_pro$,
  $html_electronics_pro$
<div class="sh-elec-wrap">
  <div class="sh-elec-hero">
    {{#main_image}}<img src="{{.}}" alt="Product" class="sh-elec-img">{{/main_image}}
    <div class="sh-elec-hero-content">
      <h1>{{title}}</h1>
      <div class="sh-elec-pill">NEXT GEN TECH</div>
    </div>
  </div>
  <div class="sh-elec-body">
    {{#product_description}}<div class="sh-elec-section">
      <p class="sh-elec-lead">{{{product_description}}}</p>
    </div>{{/product_description}}
    
    <div class="sh-elec-split">
      {{#has_features}}<div class="sh-elec-col">
        <h2>Features</h2>
        <ul class="sh-elec-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-elec-col">
        <h2>Specifications</h2>
        <div class="sh-elec-specs">
          {{#product_details}}<div class="sh-elec-spec-item">{{.}}</div>{{/product_details}}
        </div>
      </div>{{/has_details}}
    </div>
  </div>
</div>

<style>

.sh-elec-wrap { max-width: 900px; margin: 0 auto; background: #09090b; color: #e4e4e7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border: 1px solid #27272a; }
.sh-elec-hero { position: relative; background: #000; text-align: center; overflow: hidden; border-bottom: 1px solid #27272a; }
.sh-elec-img { max-width: 100%; max-height: 500px; object-fit: cover; opacity: 0.85; filter: contrast(1.1); transition: opacity 0.3s; }
.sh-elec-img:hover { opacity: 1; }
.sh-elec-hero-content { position: absolute; bottom: 0; left: 0; width: 100%; padding: 40px 20px; background: linear-gradient(transparent, #09090b); text-align: left; box-sizing: border-box; }
.sh-elec-hero-content h1 { margin: 0 0 10px 0; font-size: 36px; color: #fff; font-weight: 300; letter-spacing: -1px; }
.sh-elec-pill { display: inline-block; background: #3b82f6; color: #fff; padding: 4px 12px; border-radius: 50px; font-size: 12px; font-weight: bold; letter-spacing: 2px; }
.sh-elec-body { padding: 40px; }
.sh-elec-lead { font-size: 20px; line-height: 1.7; font-weight: 300; color: #a1a1aa; border-left: 4px solid #3b82f6; padding-left: 20px; margin-bottom: 40px; }
.sh-elec-split { display: flex; flex-wrap: wrap; gap: 40px; }
.sh-elec-col { flex: 1 1 300px; }
.sh-elec-col h2 { color: #fff; font-size: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; margin-top: 0; margin-bottom: 25px; display: flex; align-items: center; }
.sh-elec-col h2::before { content: ""; display: block; width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; margin-right: 12px; }
.sh-elec-list { list-style: none; padding: 0; margin: 0; }
.sh-elec-list li { margin-bottom: 15px; padding-left: 30px; position: relative; line-height: 1.5; color: #d4d4d8; }
.sh-elec-list li::before { content: "✓"; position: absolute; left: 0; top: 0; color: #3b82f6; font-weight: bold; font-size: 18px; }
.sh-elec-specs { display: grid; gap: 10px; }
.sh-elec-spec-item { background: #18181b; padding: 15px 20px; border-radius: 8px; border: 1px solid #27272a; font-family: monospace; font-size: 14px; color: #a1a1aa; }
@media(max-width: 600px) { .sh-elec-body { padding: 20px; } .sh-elec-hero-content h1 { font-size: 28px; } }
</style>$html_electronics_pro$,
  $json_electronics_pro${
    "title": "Premium Active Noise Cancelling Over-Ear Headphones",
    "main_image": "/template-samples/electronics-pro.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "Industry-leading noise cancellation",
        "Up to 30-hour battery life with quick charging",
        "Touch sensor controls to pause/play/skip tracks",
        "Voice assistant compatible"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Form Factor: Over Ear",
        "Connectivity: Bluetooth 5.0",
        "Color: Black"
    ],
    "product_description": "Escape into your music. These premium over-ear headphones deliver high-resolution audio and advanced noise cancellation in a sleek, lightweight design."
}$json_electronics_pro$::jsonb,
  180,
  TRUE
),

(
  'phone-accessories',
  'Phone Accessories',
  $desc_phone_accessories$Clean, simple, and colorful layout for smartphone cases, chargers, and small accessories.$desc_phone_accessories$,
  $html_phone_accessories$
<div class="sh-phone-container">
  <div class="sh-phone-top">
    <h1>{{title}}</h1>
    {{#product_description}}<p>{{{product_description}}}</p>{{/product_description}}
  </div>
  <div class="sh-phone-mid">
    {{#main_image}}<div class="sh-phone-image">
      <img src="{{.}}" alt="{{title}}">
    </div>{{/main_image}}
    {{#has_features}}<div class="sh-phone-features">
      <h3>Highlights</h3>
      <div class="sh-phone-badges">
        {{#feature_bullets}}<div class="sh-phone-badge">{{.}}</div>{{/feature_bullets}}
      </div>
    </div>{{/has_features}}
  </div>
  {{#has_details}}<div class="sh-phone-bottom">
    <h3>Specs</h3>
    <ul>
      {{#product_details}}<li>{{.}}</li>{{/product_details}}
    </ul>
  </div>{{/has_details}}
</div>

<style>

.sh-phone-container { max-width: 800px; margin: 0 auto; background: #fff; font-family: "Helvetica Neue", Helvetica, sans-serif; color: #444; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: hidden; padding: 40px; }
.sh-phone-top { text-align: center; margin-bottom: 30px; }
.sh-phone-top h1 { font-size: 32px; color: #111; margin: 0 0 15px 0; background: -webkit-linear-gradient(45deg, #ec4899, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.sh-phone-top p { font-size: 18px; line-height: 1.6; color: #666; max-width: 600px; margin: 0 auto; }
.sh-phone-mid { display: flex; flex-direction: column; align-items: center; margin-bottom: 40px; gap: 30px; }
.sh-phone-image { width: 100%; max-width: 400px; padding: 20px; background: #f8fafc; border-radius: 30px; }
.sh-phone-image img { width: 100%; height: auto; border-radius: 15px; mix-blend-mode: multiply; }
.sh-phone-features { width: 100%; text-align: center; }
.sh-phone-features h3 { font-size: 18px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
.sh-phone-badges { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.sh-phone-badge { background: #f1f5f9; color: #334155; padding: 12px 20px; border-radius: 50px; font-weight: 500; font-size: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.02); transition: transform 0.2s; }
.sh-phone-badge:hover { transform: translateY(-2px); background: #e2e8f0; }
.sh-phone-bottom { background: #fafafa; padding: 30px; border-radius: 20px; }
.sh-phone-bottom h3 { margin: 0 0 20px 0; color: #111; font-size: 20px; }
.sh-phone-bottom ul { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
.sh-phone-bottom li { padding-bottom: 10px; border-bottom: 1px solid #eee; font-size: 15px; color: #555; }
@media(max-width: 600px) { .sh-phone-container { padding: 20px; border-radius: 12px; } .sh-phone-top h1 { font-size: 26px; } }
</style>$html_phone_accessories$,
  $json_phone_accessories${
    "title": "Ultra-Slim Magnetic Wireless Charging Pad 15W",
    "main_image": "/template-samples/phone-accessories.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "15W fast charging for compatible devices",
        "Strong magnetic alignment",
        "Ultra-thin aluminum alloy body",
        "LED charging indicator"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Output: 5W / 7.5W / 10W / 15W",
        "Connector Type: USB Type-C",
        "Material: Aluminum + PU Leather"
    ],
    "product_description": "Power up quickly and stylishly. This ultra-slim wireless charger magnetically snaps to your phone, providing fast, efficient, and secure 15W charging."
}$json_phone_accessories$::jsonb,
  190,
  TRUE
),

(
  'health-household',
  'Health & Household',
  $desc_health_household$Fresh, bright, and airy layout emphasizing cleanliness and wellness.$desc_health_household$,
  $html_health_household$
<div class="sh-health-wrap">
  <div class="sh-health-grid">
    <div class="sh-health-left">
      <div class="sh-health-leaf">🌿 Natural Living</div>
      <h1>{{title}}</h1>
      {{#product_description}}<p class="sh-health-desc">{{{product_description}}}</p>{{/product_description}}
      
      {{#has_features}}<div class="sh-health-benefits">
        <h3>Benefits</h3>
        <ul>
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
    </div>
    <div class="sh-health-right">
      {{#main_image}}<img src="{{.}}" alt="{{title}}">{{/main_image}}
      
      {{#has_details}}<div class="sh-health-specs">
        <h3>Details</h3>
        {{#product_details}}<div class="sh-health-spec-row">{{.}}</div>{{/product_details}}
      </div>{{/has_details}}
    </div>
  </div>
</div>

<style>

.sh-health-wrap { max-width: 1000px; margin: 0 auto; background: #fdfbf7; color: #3f4e42; font-family: 'Georgia', serif; padding: 40px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
.sh-health-grid { display: flex; flex-wrap: wrap; gap: 40px; }
.sh-health-left { flex: 1.2 1 400px; display: flex; flex-direction: column; justify-content: center; }
.sh-health-right { flex: 1 1 350px; }
.sh-health-leaf { color: #10b981; font-family: sans-serif; text-transform: uppercase; font-weight: bold; font-size: 13px; letter-spacing: 2px; margin-bottom: 10px; }
.sh-health-left h1 { margin: 0 0 20px 0; font-size: 38px; color: #1c2b20; line-height: 1.2; font-weight: normal; }
.sh-health-desc { font-size: 18px; line-height: 1.8; margin-bottom: 30px; font-family: sans-serif; color: #5a665d; }
.sh-health-benefits { background: #fff; padding: 30px; border-radius: 12px; border: 1px solid #ecfdf5; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.05); }
.sh-health-benefits h3 { margin: 0 0 15px 0; font-family: sans-serif; color: #10b981; text-transform: uppercase; font-size: 14px; letter-spacing: 1px; }
.sh-health-benefits ul { list-style: none; padding: 0; margin: 0; font-family: sans-serif; }
.sh-health-benefits li { margin-bottom: 12px; display: flex; align-items: flex-start; }
.sh-health-benefits li::before { content: "✿"; color: #10b981; margin-right: 10px; font-size: 18px; line-height: 1; }
.sh-health-right img { width: 100%; height: auto; border-radius: 20px 20px 0 0; display: block; object-fit: cover; }
.sh-health-specs { background: #ecfdf5; padding: 25px; border-radius: 0 0 20px 20px; font-family: sans-serif; }
.sh-health-specs h3 { margin: 0 0 15px 0; color: #065f46; font-size: 16px; }
.sh-health-spec-row { padding: 10px 0; border-bottom: 1px dashed #a7f3d0; color: #047857; font-size: 14px; }
.sh-health-spec-row:last-child { border-bottom: none; }
@media(max-width: 800px) { .sh-health-wrap { padding: 20px; } .sh-health-left h1 { font-size: 30px; } }
</style>$html_health_household$,
  $json_health_household${
    "title": "Eco-Friendly Bamboo Kitchen Cleaning Brush Set",
    "main_image": "/template-samples/health-household.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "100% natural bamboo handles",
        "Durable plant-based sisal bristles",
        "Ergonomic grip for deep scrubbing",
        "Fully biodegradable and compostable"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Material: Bamboo, Sisal",
        "Type: Scrub Brush",
        "Room: Kitchen, Bathroom"
    ],
    "product_description": "Keep your home spotless without harming the planet. This set of natural bamboo scrub brushes features tough plant-based bristles that cut through grease and grime easily."
}$json_health_household$::jsonb,
  200,
  TRUE
),

(
  'industrial-scientific',
  'Industrial & Scientific',
  $desc_industrial_scientific$Highly structured, data-first layout for laboratory equipment, testing gear, and B2B supplies.$desc_industrial_scientific$,
  $html_industrial_scientific$
<div class="sh-ind-wrap">
  <div class="sh-ind-top">
    <div class="sh-ind-id">ITEM SPECIFICATION SHEET</div>
    <h1>{{title}}</h1>
  </div>
  <div class="sh-ind-body">
    <div class="sh-ind-row">
      <div class="sh-ind-img-box">
        {{#main_image}}<img src="{{.}}" alt="Product">{{/main_image}}
      </div>
      <div class="sh-ind-data">
        <div class="sh-ind-panel">
          <h3>DESCRIPTION</h3>
          <p>{{{product_description}}}</p>
        </div>
        {{#has_features}}<div class="sh-ind-panel">
          <h3>KEY FEATURES</h3>
          <ul>
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
      </div>
    </div>
    {{#has_details}}<div class="sh-ind-table-wrap">
      <h3>TECHNICAL SPECIFICATIONS</h3>
      <table>
        <tbody>
          {{#product_details}}<tr><td>{{.}}</td></tr>{{/product_details}}
        </tbody>
      </table>
    </div>{{/has_details}}
  </div>
</div>

<style>

.sh-ind-wrap { max-width: 900px; margin: 0 auto; font-family: "Consolas", "Courier New", monospace; color: #e2e8f0; background: #0f172a; border: 2px solid #334155; }
.sh-ind-top { background: #1e293b; padding: 20px 30px; border-bottom: 2px solid #334155; }
.sh-ind-id { color: #38bdf8; font-size: 12px; letter-spacing: 2px; margin-bottom: 10px; }
.sh-ind-top h1 { margin: 0; font-size: 24px; color: #f8fafc; font-weight: normal; }
.sh-ind-body { padding: 30px; }
.sh-ind-row { display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px; }
.sh-ind-img-box { flex: 1 1 300px; border: 1px solid #334155; padding: 10px; background: #000; display: flex; align-items: center; justify-content: center; }
.sh-ind-img-box img { max-width: 100%; height: auto; display: block; filter: grayscale(20%); }
.sh-ind-data { flex: 1.5 1 350px; display: flex; flex-direction: column; gap: 20px; }
.sh-ind-panel { border: 1px solid #334155; padding: 20px; background: #020617; }
.sh-ind-panel h3, .sh-ind-table-wrap h3 { margin: 0 0 15px 0; color: #38bdf8; font-size: 16px; border-bottom: 1px dashed #334155; padding-bottom: 10px; }
.sh-ind-panel p { margin: 0; line-height: 1.5; font-size: 14px; color: #cbd5e1; }
.sh-ind-panel ul { margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.6; }
.sh-ind-table-wrap { border: 1px solid #334155; padding: 20px; background: #020617; }
.sh-ind-table-wrap table { width: 100%; border-collapse: collapse; font-size: 14px; }
.sh-ind-table-wrap td { padding: 10px; border-bottom: 1px solid #1e293b; color: #94a3b8; }
.sh-ind-table-wrap tr:last-child td { border-bottom: none; }
</style>$html_industrial_scientific$,
  $json_industrial_scientific${
    "title": "Digital Vernier Caliper Stainless Steel 150mm/6\"",
    "main_image": "/template-samples/industrial-scientific.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "Large LCD screen for easy reading",
        "Precision measuring up to 0.01mm / 0.0005inch",
        "Hardened stainless steel body",
        "Zero setting in any position"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Material: Stainless Steel",
        "Measurement Range: 0-150mm / 0-6\"",
        "Accuracy: ±0.02mm"
    ],
    "product_description": "Achieve absolute precision in your measurements. This industrial-grade digital caliper delivers highly accurate readings on a large LCD display, built with hardened stainless steel."
}$json_industrial_scientific$::jsonb,
  210,
  TRUE
),

(
  'office-products',
  'Office Products',
  $desc_office_products$Professional, uncluttered layout perfect for furniture, stationery, and workspace organization.$desc_office_products$,
  $html_office_products$
<div class="sh-off-container">
  <div class="sh-off-header">
    <div class="sh-off-logo">WORKSPACE ESSENTIALS</div>
  </div>
  <div class="sh-off-main">
    <div class="sh-off-title-area">
      <h1>{{title}}</h1>
      <div class="sh-off-divider"></div>
      {{#product_description}}<p class="sh-off-desc">{{{product_description}}}</p>{{/product_description}}
    </div>
    
    <div class="sh-off-content">
      {{#main_image}}<div class="sh-off-image">
        <img src="{{.}}" alt="Product">
      </div>{{/main_image}}
      
      <div class="sh-off-info">
        {{#has_features}}<div class="sh-off-card">
          <h3>Product Features</h3>
          <ul>
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
        
        {{#has_details}}<div class="sh-off-card">
          <h3>Specifications</h3>
          <ul>
            {{#product_details}}<li>{{.}}</li>{{/product_details}}
          </ul>
        </div>{{/has_details}}
      </div>
    </div>
  </div>
</div>

<style>

.sh-off-container { max-width: 960px; margin: 0 auto; background: #fff; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
.sh-off-header { background: #1e3a8a; padding: 20px 40px; text-align: center; }
.sh-off-logo { color: #fff; font-size: 14px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.9; }
.sh-off-main { padding: 40px; }
.sh-off-title-area { text-align: center; margin-bottom: 40px; }
.sh-off-title-area h1 { font-size: 32px; color: #1e3a8a; margin: 0; font-weight: 300; }
.sh-off-divider { width: 60px; height: 3px; background: #3b82f6; margin: 20px auto; }
.sh-off-desc { font-size: 16px; line-height: 1.6; color: #64748b; max-width: 700px; margin: 0 auto; }
.sh-off-content { display: flex; flex-wrap: wrap; gap: 40px; }
.sh-off-image { flex: 1 1 400px; }
.sh-off-image img { width: 100%; height: auto; border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px; }
.sh-off-info { flex: 1 1 350px; display: flex; flex-direction: column; gap: 20px; }
.sh-off-card { background: #f8fafc; padding: 25px; border-left: 4px solid #1e3a8a; border-radius: 0 4px 4px 0; }
.sh-off-card h3 { margin: 0 0 15px 0; color: #0f172a; font-size: 18px; font-weight: 600; }
.sh-off-card ul { padding-left: 20px; margin: 0; color: #475569; line-height: 1.6; }
.sh-off-card li { margin-bottom: 8px; }
@media(max-width: 600px) { .sh-off-main { padding: 20px; } .sh-off-title-area h1 { font-size: 24px; } }
</style>$html_office_products$,
  $json_office_products${
    "title": "Ergonomic Mesh Office Chair with Lumbar Support",
    "main_image": "/template-samples/office-products.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "Breathable high-density mesh back",
        "Adjustable lumbar support and headrest",
        "Thick padded seat cushion",
        "Smooth-rolling caster wheels"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Material: Mesh, Nylon",
        "Style: Ergonomic Desk Chair",
        "Weight Capacity: 300 lbs"
    ],
    "product_description": "Work in comfort all day. This ergonomic office chair features a breathable mesh back and fully adjustable lumbar support to promote proper posture and reduce back strain."
}$json_office_products$::jsonb,
  220,
  TRUE
),

(
  'patio-lawn-garden',
  'Patio, Lawn & Garden',
  $desc_patio_lawn_garden$Earth-toned, outdoor-inspired layout for gardening tools, patio furniture, and outdoor decor.$desc_patio_lawn_garden$,
  $html_patio_lawn_garden$
<div class="sh-patio-wrap">
  <div class="sh-patio-hero">
    {{#main_image}}<div class="sh-patio-hero-bg" style="background-image: url('{{.}}')"></div>{{/main_image}}
    <div class="sh-patio-hero-overlay">
      <h1>{{title}}</h1>
    </div>
  </div>
  
  <div class="sh-patio-content">
    {{#product_description}}<div class="sh-patio-intro">
      <p>{{{product_description}}}</p>
    </div>{{/product_description}}
    
    <div class="sh-patio-cols">
      {{#has_features}}<div class="sh-patio-col">
        <h3>Why You'll Love It</h3>
        <ul>
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-patio-col">
        <h3>Product Details</h3>
        <ul>
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
      </div>{{/has_details}}
    </div>
  </div>
</div>

<style>

.sh-patio-wrap { max-width: 900px; margin: 0 auto; background: #faf9f6; color: #4a4a4a; font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif; }
.sh-patio-hero { position: relative; height: 400px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 8px solid #65a30d; }
.sh-patio-hero-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; filter: blur(3px) brightness(0.6); transform: scale(1.05); }
.sh-patio-hero-overlay { position: relative; z-index: 1; text-align: center; padding: 0 40px; }
.sh-patio-hero-overlay h1 { color: #fff; font-size: 38px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); font-weight: normal; margin: 0; letter-spacing: 1px; }
.sh-patio-content { padding: 50px 40px; }
.sh-patio-intro { text-align: center; font-size: 20px; line-height: 1.6; color: #5c4d43; margin-bottom: 50px; font-style: italic; max-width: 700px; margin-left: auto; margin-right: auto; }
.sh-patio-cols { display: flex; flex-wrap: wrap; gap: 40px; }
.sh-patio-col { flex: 1 1 300px; background: #fff; border: 1px solid #e5e5e5; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
.sh-patio-col h3 { color: #4d7c0f; font-size: 22px; margin-top: 0; margin-bottom: 20px; border-bottom: 2px solid #bef264; padding-bottom: 10px; }
.sh-patio-col ul { padding: 0; margin: 0; list-style: none; }
.sh-patio-col li { padding: 10px 0; border-bottom: 1px solid #f3f4f6; position: relative; padding-left: 25px; line-height: 1.5; }
.sh-patio-col li:last-child { border-bottom: none; }
.sh-patio-col li::before { content: "•"; position: absolute; left: 5px; color: #65a30d; font-size: 20px; top: 8px; }
@media(max-width: 600px) { .sh-patio-hero { height: 250px; } .sh-patio-hero-overlay h1 { font-size: 28px; } .sh-patio-content { padding: 30px 20px; } }
</style>$html_patio_lawn_garden$,
  $json_patio_lawn_garden${
    "title": "Heavy Duty Stainless Steel Gardening Tool Set (3 Piece)",
    "main_image": "/template-samples/patio-lawn-garden.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "Includes trowel, transplanter, and cultivator",
        "Rust-resistant cast aluminum heads",
        "Ergonomic soft-grip handles reduce hand fatigue",
        "Convenient hanging holes for storage"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Material: Aluminum, TPR",
        "Number of Pieces: 3",
        "Application: Gardening"
    ],
    "product_description": "Dig, plant, and weed with ease. This 3-piece heavy-duty gardening set is crafted from rust-resistant cast aluminum and features ergonomic handles for maximum comfort."
}$json_patio_lawn_garden$::jsonb,
  230,
  TRUE
),

(
  'general-store-alt',
  'General Store Alt',
  $desc_general_store_alt$A versatile, modern alternative general layout with subtle gradients and soft shadows.$desc_general_store_alt$,
  $html_general_store_alt$
<div class="sh-galt-wrap">
  <div class="sh-galt-inner">
    <div class="sh-galt-gallery">
      {{#main_image}}<img src="{{.}}" alt="{{title}}">{{/main_image}}
    </div>
    <div class="sh-galt-content">
      <div class="sh-galt-tag">BEST SELLER</div>
      <h1>{{title}}</h1>
      {{#product_description}}<p class="sh-galt-desc">{{{product_description}}}</p>{{/product_description}}
      
      <div class="sh-galt-guarantees">
        <span>✅ Verified Quality</span>
        <span>✅ Fast Dispatch</span>
        <span>✅ Easy Returns</span>
      </div>
      
      <div class="sh-galt-accordion">
        {{#has_features}}<div class="sh-galt-block">
          <h3>Why Choose This?</h3>
          <ul>
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
        
        {{#has_details}}<div class="sh-galt-block">
          <h3>Specifications</h3>
          <div class="sh-galt-specs">
            {{#product_details}}<span>{{.}}</span>{{/product_details}}
          </div>
        </div>{{/has_details}}
      </div>
    </div>
  </div>
</div>

<style>

.sh-galt-wrap { max-width: 1000px; margin: 0 auto; background: #f8fafc; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.sh-galt-inner { display: flex; flex-wrap: wrap; background: #fff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.06); overflow: hidden; }
.sh-galt-gallery { flex: 1 1 400px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; padding: 40px; }
.sh-galt-gallery img { max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
.sh-galt-content { flex: 1.2 1 400px; padding: 50px 40px; }
.sh-galt-tag { display: inline-block; background: #ef4444; color: #fff; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 4px; margin-bottom: 15px; letter-spacing: 1px; }
.sh-galt-content h1 { margin: 0 0 20px 0; font-size: 30px; color: #0f172a; line-height: 1.3; }
.sh-galt-desc { font-size: 17px; color: #64748b; line-height: 1.6; margin-bottom: 30px; }
.sh-galt-guarantees { display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.sh-galt-guarantees span { font-size: 14px; color: #334155; font-weight: 500; }
.sh-galt-block { margin-bottom: 30px; }
.sh-galt-block h3 { font-size: 18px; color: #0f172a; margin-top: 0; margin-bottom: 15px; }
.sh-galt-block ul { padding-left: 20px; color: #475569; margin: 0; line-height: 1.6; }
.sh-galt-block li { margin-bottom: 8px; }
.sh-galt-specs { display: flex; flex-wrap: wrap; gap: 10px; }
.sh-galt-specs span { background: #e2e8f0; padding: 6px 12px; border-radius: 20px; font-size: 13px; color: #334155; }
@media(max-width: 768px) { .sh-galt-wrap { padding: 15px; } .sh-galt-content { padding: 30px 20px; } .sh-galt-gallery { padding: 20px; } }
</style>$html_general_store_alt$,
  $json_general_store_alt${
    "title": "Double Wall Vacuum Insulated Stainless Steel Water Bottle",
    "main_image": "/template-samples/general-store-alt.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
        "Keeps cold for 24 hours, hot for 12 hours",
        "Premium 18/8 food-grade stainless steel",
        "Leak-proof and condensation-free exterior",
        "Fits most standard cup holders"
    ],
    "product_details": [
        "Brand: Unbranded",
        "Material: Stainless Steel",
        "Capacity: 32 oz",
        "Features: Insulated"
    ],
    "product_description": "Stay hydrated wherever you go. This vacuum insulated stainless steel water bottle is designed to keep your drinks at the perfect temperature all day, completely condensation-free."
}$json_general_store_alt$::jsonb,
  240,
  TRUE
);

/*
$template_samples$
{
  "tools-home-improvement": {
    "title": "High-Torque Cordless Power Drill 20V Max",
    "main_image": "/template-samples/tools-home-improvement.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Brushless motor for extended runtime",
      "2-speed transmission (0-600 / 0-2000 RPM)",
      "Compact, lightweight design fits into tight areas",
      "Heavy-duty 1/2-inch ratcheting chuck"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Voltage: 20V",
      "Power Source: Battery",
      "Chuck Size: 1/2 in"
    ],
    "product_description": "Tackle the toughest jobs with this 20V Max high-torque cordless drill. Featuring a brushless motor for increased power and durability, it delivers the performance needed for heavy-duty applications."
  },
  "electronics-pro": {
    "title": "Premium Active Noise Cancelling Over-Ear Headphones",
    "main_image": "/template-samples/electronics-pro.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Industry-leading noise cancellation",
      "Up to 30-hour battery life with quick charging",
      "Touch sensor controls to pause/play/skip tracks",
      "Voice assistant compatible"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Form Factor: Over Ear",
      "Connectivity: Bluetooth 5.0",
      "Color: Black"
    ],
    "product_description": "Escape into your music. These premium over-ear headphones deliver high-resolution audio and advanced noise cancellation in a sleek, lightweight design."
  },
  "phone-accessories": {
    "title": "Ultra-Slim Magnetic Wireless Charging Pad 15W",
    "main_image": "/template-samples/phone-accessories.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "15W fast charging for compatible devices",
      "Strong magnetic alignment",
      "Ultra-thin aluminum alloy body",
      "LED charging indicator"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Output: 5W / 7.5W / 10W / 15W",
      "Connector Type: USB Type-C",
      "Material: Aluminum + PU Leather"
    ],
    "product_description": "Power up quickly and stylishly. This ultra-slim wireless charger magnetically snaps to your phone, providing fast, efficient, and secure 15W charging."
  },
  "health-household": {
    "title": "Eco-Friendly Bamboo Kitchen Cleaning Brush Set",
    "main_image": "/template-samples/health-household.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "100% natural bamboo handles",
      "Durable plant-based sisal bristles",
      "Ergonomic grip for deep scrubbing",
      "Fully biodegradable and compostable"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Bamboo, Sisal",
      "Type: Scrub Brush",
      "Room: Kitchen, Bathroom"
    ],
    "product_description": "Keep your home spotless without harming the planet. This set of natural bamboo scrub brushes features tough plant-based bristles that cut through grease and grime easily."
  },
  "industrial-scientific": {
    "title": "Digital Vernier Caliper Stainless Steel 150mm/6\"",
    "main_image": "/template-samples/industrial-scientific.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Large LCD screen for easy reading",
      "Precision measuring up to 0.01mm / 0.0005inch",
      "Hardened stainless steel body",
      "Zero setting in any position"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Stainless Steel",
      "Measurement Range: 0-150mm / 0-6\"",
      "Accuracy: ±0.02mm"
    ],
    "product_description": "Achieve absolute precision in your measurements. This industrial-grade digital caliper delivers highly accurate readings on a large LCD display, built with hardened stainless steel."
  },
  "office-products": {
    "title": "Ergonomic Mesh Office Chair with Lumbar Support",
    "main_image": "/template-samples/office-products.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Breathable high-density mesh back",
      "Adjustable lumbar support and headrest",
      "Thick padded seat cushion",
      "Smooth-rolling caster wheels"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Mesh, Nylon",
      "Style: Ergonomic Desk Chair",
      "Weight Capacity: 300 lbs"
    ],
    "product_description": "Work in comfort all day. This ergonomic office chair features a breathable mesh back and fully adjustable lumbar support to promote proper posture and reduce back strain."
  },
  "patio-lawn-garden": {
    "title": "Heavy Duty Stainless Steel Gardening Tool Set (3 Piece)",
    "main_image": "/template-samples/patio-lawn-garden.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Includes trowel, transplanter, and cultivator",
      "Rust-resistant cast aluminum heads",
      "Ergonomic soft-grip handles reduce hand fatigue",
      "Convenient hanging holes for storage"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Aluminum, TPR",
      "Number of Pieces: 3",
      "Application: Gardening"
    ],
    "product_description": "Dig, plant, and weed with ease. This 3-piece heavy-duty gardening set is crafted from rust-resistant cast aluminum and features ergonomic handles for maximum comfort."
  },
  "general-store-alt": {
    "title": "Double Wall Vacuum Insulated Stainless Steel Water Bottle",
    "main_image": "/template-samples/general-store-alt.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Keeps cold for 24 hours, hot for 12 hours",
      "Premium 18/8 food-grade stainless steel",
      "Leak-proof and condensation-free exterior",
      "Fits most standard cup holders"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Stainless Steel",
      "Capacity: 32 oz",
      "Features: Insulated"
    ],
    "product_description": "Stay hydrated wherever you go. This vacuum insulated stainless steel water bottle is designed to keep your drinks at the perfect temperature all day, completely condensation-free."
  }
}
$template_samples$
*/
