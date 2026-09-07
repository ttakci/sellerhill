-- apps/api/migrations/073_dropshipping_templates_catalog.sql
-- Deletes the previous templates and replaces them with 12 new dropshipping-specific templates.

DELETE FROM predefined_templates;

INSERT INTO predefined_templates (slug, name, description, html_content, sample_data, sort_order, is_active) VALUES

-- ---------------------------------------------------------------------------
-- 10. General Store
-- ---------------------------------------------------------------------------
(
  'ds-general-store',
  'DS General Store',
  $desc_general$A high-conversion, urgency-driven layout suitable for any general dropshipping product with clear trust badges.$desc_general$,
  $html_general$<div class="sh-gs-container">
  <div class="sh-gs-header">
    <h1>{{title}}</h1>
    <div class="sh-gs-badges">
      <span class="sh-gs-badge">✓ Fast Shipping</span>
      <span class="sh-gs-badge">✓ Top Quality</span>
      <span class="sh-gs-badge">✓ 30-Day Returns</span>
    </div>
  </div>
  <div class="sh-gs-main">
    {{#main_image}}<div class="sh-gs-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    <div class="sh-gs-content">
      {{#product_description}}<div class="sh-gs-section">
        <h2>Product Overview</h2>
        <div class="sh-gs-prose">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-gs-section">
        <h2>Key Benefits</h2>
        <ul class="sh-gs-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
    </div>
  </div>
  
  {{#has_details}}<div class="sh-gs-details">
    <h2>Specifications</h2>
    <table class="sh-gs-table">
      <tbody>
        {{#product_details}}<tr><td>{{.}}</td></tr>{{/product_details}}
      </tbody>
    </table>
  </div>{{/has_details}}

  <div class="sh-gs-footer">
    <div class="sh-gs-trust-box">
      <h3>Shipping & Handling</h3>
      <p>Orders are processed within 1-3 business days. Delivery typically takes 5-10 business days depending on location.</p>
    </div>
    <div class="sh-gs-trust-box">
      <h3>Returns & Refunds</h3>
      <p>If you are not 100% satisfied with your purchase, you can return the product and get a full refund within 30 days of receipt.</p>
    </div>
  </div>
</div>
<style>
.sh-gs-container { max-width: 900px; margin: 0 auto; font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
.sh-gs-header { text-align: center; padding: 20px; background: #f8f9fa; border-bottom: 3px solid #e11d48; margin-bottom: 30px; }
.sh-gs-header h1 { font-size: 24px; color: #111; margin: 0 0 15px 0; }
.sh-gs-badges { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
.sh-gs-badge { background: #e11d48; color: #fff; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; }
.sh-gs-main { display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px; }
.sh-gs-image { flex: 1 1 350px; text-align: center; }
.sh-gs-image img { max-width: 100%; border: 1px solid #ddd; border-radius: 8px; }
.sh-gs-content { flex: 1.2 1 350px; }
.sh-gs-section { margin-bottom: 25px; }
.sh-gs-section h2 { font-size: 18px; border-bottom: 2px solid #eee; padding-bottom: 8px; color: #e11d48; margin-top: 0; }
.sh-gs-list { list-style-type: none; padding: 0; margin: 0; }
.sh-gs-list li { margin-bottom: 10px; padding-left: 25px; position: relative; }
.sh-gs-list li::before { content: "✅"; position: absolute; left: 0; top: 0; }
.sh-gs-details { margin-bottom: 30px; }
.sh-gs-details h2 { font-size: 18px; border-bottom: 2px solid #eee; padding-bottom: 8px; color: #e11d48; }
.sh-gs-table { width: 100%; border-collapse: collapse; }
.sh-gs-table td { padding: 10px; border-bottom: 1px solid #eee; }
.sh-gs-footer { display: flex; flex-wrap: wrap; gap: 20px; background: #f8f9fa; padding: 20px; border-radius: 8px; }
.sh-gs-trust-box { flex: 1 1 250px; }
.sh-gs-trust-box h3 { font-size: 16px; color: #333; margin-top: 0; }
.sh-gs-trust-box p { font-size: 14px; color: #555; margin: 0; }
@media (max-width: 600px) {
  .sh-gs-main { flex-direction: column; }
  .sh-gs-badges { flex-direction: column; align-items: center; }
}
</style>$html_general$,
  $json_general${
      "title": "Smart Fitness Watch with Heart Rate Monitor",
      "main_image": "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "24/7 Heart rate monitoring",
          "IP68 Waterproof rating",
          "14 Sport modes tracking",
          "Sleep analysis & tracking"
      ],
      "product_details": [
          "Compatibility: iOS 9.0+ / Android 5.0+",
          "Battery Life: Up to 10 days",
          "Charging Time: 2 hours"
      ],
      "product_description": "Stay on top of your health goals with this premium smartwatch. Tracks steps, calories, and sleep automatically."
  }$json_general$::jsonb,
  10,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 20. Minimalist
-- ---------------------------------------------------------------------------
(
  'ds-minimalist',
  'DS Minimalist',
  $desc_minimalist$Ultra-clean, single-column, black & white layout focusing purely on specs and trust. The safest and fastest-loading option.$desc_minimalist$,
  $html_minimalist$<div class="sh-min-wrapper">
  <h1 class="sh-min-title">{{title}}</h1>
  
  <div class="sh-min-promises">
    <span>Free Shipping</span> | <span>30 Day Returns</span> | <span>Secure Checkout</span>
  </div>

  {{#product_description}}<div class="sh-min-block">
    <div class="sh-min-prose">{{{product_description}}}</div>
  </div>{{/product_description}}

  {{#has_features}}<div class="sh-min-block">
    <h3 class="sh-min-heading">Features</h3>
    <ul class="sh-min-list">
      {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
    </ul>
  </div>{{/has_features}}

  {{#has_details}}<div class="sh-min-block">
    <h3 class="sh-min-heading">Details</h3>
    <ul class="sh-min-list">
      {{#product_details}}<li>{{.}}</li>{{/product_details}}
    </ul>
  </div>{{/has_details}}

  <div class="sh-min-policies">
    <p><strong>Shipping:</strong> Standard 5-10 business day shipping. Tracking provided on all orders.</p>
    <p><strong>Returns:</strong> 30-day money-back guarantee. Buyer pays return shipping unless item is defective.</p>
  </div>
</div>
<style>
.sh-min-wrapper { max-width: 800px; margin: 0 auto; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #000; padding: 20px; line-height: 1.5; font-size: 16px; }
.sh-min-title { font-size: 24px; font-weight: normal; margin: 0 0 15px 0; border-bottom: 1px solid #000; padding-bottom: 10px; }
.sh-min-promises { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 30px; text-align: center; }
.sh-min-block { margin-bottom: 30px; }
.sh-min-heading { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; margin: 0 0 15px 0; }
.sh-min-list { list-style: disc; padding-left: 20px; margin: 0; }
.sh-min-list li { margin-bottom: 8px; color: #333; }
.sh-min-policies { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
.sh-min-policies p { margin-bottom: 10px; }
</style>$html_minimalist$,
  $json_minimalist${
      "title": "Minimalist Leather Wallet for Men",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "RFID Blocking technology",
          "Holds up to 10 cards",
          "Genuine full-grain leather"
      ],
      "product_details": [
          "Dimensions: 4.5\" x 3.2\"",
          "Weight: 2.1 oz",
          "Color: Matte Black"
      ],
      "product_description": "A slim, front-pocket wallet designed to carry your essentials without the bulk. Crafted from premium leather that ages beautifully over time."
  }$json_minimalist$::jsonb,
  20,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 30. Tech Gadgets
-- ---------------------------------------------------------------------------
(
  'ds-tech-gadgets',
  'DS Tech Gadgets',
  $desc_tech$Modern, dark-accented layout ideal for electronics, featuring a prominent specs table.$desc_tech$,
  $html_tech$<div class="sh-tg-wrap">
  <div class="sh-tg-head">
    <div class="sh-tg-head-inner">
      <h1>{{title}}</h1>
    </div>
  </div>
  <div class="sh-tg-body">
    {{#main_image}}<div class="sh-tg-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-tg-grid">
      <div class="sh-tg-col">
        {{#product_description}}<div class="sh-tg-panel">
          <h2>Product Description</h2>
          <div class="sh-tg-prose">{{{product_description}}}</div>
        </div>{{/product_description}}
        
        {{#has_features}}<div class="sh-tg-panel">
          <h2>Technical Features</h2>
          <ul class="sh-tg-list">
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
      </div>
      
      <div class="sh-tg-col">
        {{#has_details}}<div class="sh-tg-panel sh-tg-spec-panel">
          <h2>Specifications</h2>
          <table class="sh-tg-table">
            <tbody>
              {{#product_details}}<tr><td>{{.}}</td></tr>{{/product_details}}
            </tbody>
          </table>
        </div>{{/has_details}}
        
        <div class="sh-tg-panel">
          <h2>Shipping & Warranty</h2>
          <p class="sh-tg-small-text"><strong>Handling Time:</strong> 2 Business Days</p>
          <p class="sh-tg-small-text"><strong>Delivery:</strong> 5-8 Business Days via Standard Carrier</p>
          <p class="sh-tg-small-text"><strong>Warranty:</strong> 1 Year Limited Supplier Warranty</p>
          <p class="sh-tg-small-text"><strong>Returns:</strong> Accepted within 30 days in original packaging.</p>
        </div>
      </div>
    </div>
  </div>
</div>
<style>
.sh-tg-wrap { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #1e293b; max-width: 960px; margin: 0 auto; border-radius: 8px; overflow: hidden; }
.sh-tg-wrap img { max-width: 100%; height: auto; }
.sh-tg-head { background: #0f172a; color: #fff; padding: 30px; text-align: center; }
.sh-tg-head h1 { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.5px; }
.sh-tg-body { padding: 30px; }
.sh-tg-image { text-align: center; margin-bottom: 30px; background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.sh-tg-image img { max-width: 500px; }
.sh-tg-grid { display: flex; flex-wrap: wrap; gap: 24px; }
.sh-tg-col { flex: 1 1 300px; }
.sh-tg-panel { background: #fff; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.sh-tg-panel h2 { font-size: 16px; text-transform: uppercase; color: #3b82f6; margin: 0 0 15px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
.sh-tg-prose { font-size: 15px; color: #475569; line-height: 1.6; }
.sh-tg-list { list-style: none; padding: 0; margin: 0; }
.sh-tg-list li { position: relative; padding-left: 20px; margin-bottom: 8px; color: #475569; font-size: 15px; }
.sh-tg-list li::before { content: "■"; color: #3b82f6; position: absolute; left: 0; font-size: 10px; top: 4px; }
.sh-tg-spec-panel { background: #1e293b; color: #f8fafc; }
.sh-tg-spec-panel h2 { color: #38bdf8; border-color: #334155; }
.sh-tg-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.sh-tg-table td { padding: 10px 0; border-bottom: 1px solid #334155; }
.sh-tg-small-text { font-size: 14px; margin: 0 0 10px 0; color: #64748b; }
@media (max-width: 768px) {
  .sh-tg-head { padding: 20px; }
  .sh-tg-body { padding: 20px; }
  .sh-tg-image img { max-width: 100%; }
}
</style>$html_tech$,
  $json_tech${
      "title": "Pro Wireless Gaming Mouse 16000 DPI RGB",
      "main_image": "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Ultra-fast 1ms wireless connectivity",
          "16,000 DPI optical sensor",
          "Customizable RGB lighting",
          "6 programmable buttons"
      ],
      "product_details": [
          "Weight: 80g",
          "Battery: Up to 50 hours",
          "Sensor: Optical PWM3389"
      ],
      "product_description": "Designed for esports professionals, this wireless gaming mouse offers unmatched speed and precision."
  }$json_tech$::jsonb,
  30,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 40. Home Decor
-- ---------------------------------------------------------------------------
(
  'ds-home-decor',
  'DS Home Decor',
  $desc_home$Warm, aesthetic layout with soft colors, large image emphasis, and a cozy typography setup.$desc_home$,
  $html_home$<div class="sh-hd-container">
  <div class="sh-hd-banner">
    <h1 class="sh-hd-title">{{title}}</h1>
    <p class="sh-hd-subtitle">Premium Home Collection</p>
  </div>
  
  <div class="sh-hd-main">
    {{#main_image}}<div class="sh-hd-img-wrap"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-hd-box">
      {{#product_description}}<div class="sh-hd-desc">
        <h2 class="sh-hd-heading">About This Item</h2>
        <div class="sh-hd-text">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      <div class="sh-hd-row">
        {{#has_features}}<div class="sh-hd-col">
          <h2 class="sh-hd-heading">Highlights</h2>
          <ul class="sh-hd-list">
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
        
        {{#has_details}}<div class="sh-hd-col">
          <h2 class="sh-hd-heading">Product Details</h2>
          <ul class="sh-hd-list">
            {{#product_details}}<li>{{.}}</li>{{/product_details}}
          </ul>
        </div>{{/has_details}}
      </div>
    </div>
  </div>
  
  <div class="sh-hd-policy">
    <div class="sh-hd-policy-item">
      <h3>Shipping Information</h3>
      <p>We carefully package every item to ensure it arrives in pristine condition. Delivery usually takes 4-7 business days.</p>
    </div>
    <div class="sh-hd-policy-item">
      <h3>Customer Satisfaction</h3>
      <p>If your item arrives damaged or you simply change your mind, please contact us within 30 days for a hassle-free return.</p>
    </div>
  </div>
</div>
<style>
.sh-hd-container { max-width: 850px; margin: 0 auto; font-family: "Georgia", serif; color: #4a4a4a; background: #faf8f5; border: 1px solid #eae2d8; }
.sh-hd-container img { max-width: 100%; height: auto; display: block; }
.sh-hd-banner { padding: 40px 20px; text-align: center; background: #fff; border-bottom: 1px solid #eae2d8; }
.sh-hd-title { font-size: 28px; font-weight: normal; margin: 0 0 10px 0; color: #333; }
.sh-hd-subtitle { font-family: "Arial", sans-serif; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #888; margin: 0; }
.sh-hd-main { padding: 30px; }
.sh-hd-img-wrap { margin-bottom: 30px; text-align: center; }
.sh-hd-box { background: #fff; padding: 30px; border-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
.sh-hd-heading { font-family: "Arial", sans-serif; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #b59f84; margin: 0 0 15px 0; border-bottom: 1px solid #f0eae1; padding-bottom: 10px; }
.sh-hd-text { font-size: 16px; line-height: 1.8; color: #555; margin-bottom: 30px; }
.sh-hd-row { display: flex; flex-wrap: wrap; gap: 30px; }
.sh-hd-col { flex: 1 1 250px; }
.sh-hd-list { list-style: none; padding: 0; margin: 0; font-family: "Arial", sans-serif; font-size: 14px; line-height: 1.6; }
.sh-hd-list li { margin-bottom: 8px; position: relative; padding-left: 15px; color: #666; }
.sh-hd-list li::before { content: "•"; position: absolute; left: 0; color: #b59f84; }
.sh-hd-policy { display: flex; flex-wrap: wrap; border-top: 1px solid #eae2d8; background: #fff; }
.sh-hd-policy-item { flex: 1 1 300px; padding: 30px; text-align: center; border-right: 1px solid #eae2d8; }
.sh-hd-policy-item:last-child { border-right: none; }
.sh-hd-policy-item h3 { font-family: "Arial", sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; color: #333; }
.sh-hd-policy-item p { font-size: 14px; color: #777; margin: 0; }
@media (max-width: 600px) {
  .sh-hd-main { padding: 15px; }
  .sh-hd-box { padding: 20px; }
  .sh-hd-policy-item { border-right: none; border-bottom: 1px solid #eae2d8; }
}
</style>$html_home$,
  $json_home${
      "title": "Boho Macrame Wall Hanging Large Handwoven Tapestry",
      "main_image": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "100% natural cotton cord",
          "Handwoven unique geometric design",
          "Includes wooden dowel for hanging"
      ],
      "product_details": [
          "Dimensions: 35\" W x 40\" L",
          "Color: Natural Cream",
          "Style: Bohemian / Minimalist"
      ],
      "product_description": "Add warmth and texture to any room with this beautiful, handcrafted macrame wall hanging. Perfect for living rooms, bedrooms, or nurseries."
  }$json_home$::jsonb,
  40,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 50. Auto Parts
-- ---------------------------------------------------------------------------
(
  'ds-auto-parts',
  'DS Auto Parts',
  $desc_auto$High-contrast technical layout with clear fitment warnings and rugged styling.$desc_auto$,
  $html_auto$<div class="sh-ap-wrap">
  <div class="sh-ap-header">
    <h1>{{title}}</h1>
  </div>
  <div class="sh-ap-notice">
    <strong>⚠️ IMPORTANT FITMENT NOTICE:</strong> Please check your vehicle compatibility before purchasing. If you are unsure, contact us with your VIN.
  </div>
  <div class="sh-ap-main">
    {{#main_image}}<div class="sh-ap-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    <div class="sh-ap-content">
      {{#product_description}}<div class="sh-ap-block">
        <h2>Item Description</h2>
        <div class="sh-ap-prose">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-ap-block">
        <h2>Features</h2>
        <ul class="sh-ap-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-ap-block">
        <h2>Specifications</h2>
        <table class="sh-ap-table">
          <tbody>
            {{#product_details}}<tr><td>{{.}}</td></tr>{{/product_details}}
          </tbody>
        </table>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-ap-policies">
    <div class="sh-ap-policy">
      <h3>SHIPPING</h3>
      <p>Orders are dispatched within 1-2 business days. Tracking is automatically uploaded to eBay.</p>
    </div>
    <div class="sh-ap-policy">
      <h3>RETURNS</h3>
      <p>30-Day returns accepted. Parts must be uninstalled and in original packaging. Buyer pays return shipping.</p>
    </div>
    <div class="sh-ap-policy">
      <h3>WARRANTY</h3>
      <p>We offer a 1-year replacement warranty on manufacturing defects. Does not cover labor costs.</p>
    </div>
  </div>
</div>
<style>
.sh-ap-wrap { max-width: 900px; margin: 0 auto; font-family: "Arial", sans-serif; background: #fff; border: 1px solid #ccc; }
.sh-ap-wrap img { max-width: 100%; height: auto; }
.sh-ap-header { background: #111; color: #fff; padding: 20px; text-align: center; border-bottom: 4px solid #cc0000; }
.sh-ap-header h1 { margin: 0; font-size: 24px; text-transform: uppercase; }
.sh-ap-notice { background: #fff3cd; color: #856404; padding: 15px; text-align: center; font-size: 14px; border-bottom: 1px solid #ffeeba; }
.sh-ap-main { padding: 20px; display: flex; flex-wrap: wrap; gap: 30px; }
.sh-ap-image { flex: 1 1 300px; text-align: center; }
.sh-ap-image img { border: 1px solid #eee; padding: 10px; }
.sh-ap-content { flex: 2 1 400px; }
.sh-ap-block { margin-bottom: 25px; }
.sh-ap-block h2 { font-size: 16px; color: #111; text-transform: uppercase; border-bottom: 2px solid #cc0000; padding-bottom: 5px; margin: 0 0 15px 0; }
.sh-ap-prose { font-size: 15px; color: #333; line-height: 1.5; }
.sh-ap-list { list-style: square; padding-left: 20px; margin: 0; color: #333; font-size: 14px; }
.sh-ap-list li { margin-bottom: 5px; }
.sh-ap-table { width: 100%; border-collapse: collapse; font-size: 14px; color: #333; }
.sh-ap-table td { padding: 8px; border-bottom: 1px solid #eee; }
.sh-ap-table tr:nth-child(odd) { background: #f9f9f9; }
.sh-ap-policies { display: flex; flex-wrap: wrap; background: #f4f4f4; border-top: 1px solid #ddd; }
.sh-ap-policy { flex: 1 1 250px; padding: 20px; }
.sh-ap-policy h3 { font-size: 14px; color: #cc0000; margin: 0 0 10px 0; }
.sh-ap-policy p { font-size: 13px; color: #555; margin: 0; line-height: 1.4; }
@media (max-width: 600px) {
  .sh-ap-main { flex-direction: column; }
}
</style>$html_auto$,
  $json_auto${
      "title": "Front Ceramic Brake Pads For 2010-2015 Honda Civic",
      "main_image": "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Low dust ceramic formula",
          "Noise-free braking performance",
          "Includes premium stainless steel hardware",
          "Direct OEM replacement"
      ],
      "product_details": [
          "Placement on Vehicle: Front Left, Front Right",
          "Pad Material: Ceramic",
          "Fitment Type: Direct Replacement",
          "Surface Finish: Premium Powder Coat"
      ],
      "product_description": "Upgrade your stopping power with our premium ceramic brake pads. Engineered to minimize dust and eliminate noise for a smooth, reliable ride."
  }$json_auto$::jsonb,
  50,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 60. Apparel Fashion
-- ---------------------------------------------------------------------------
(
  'ds-apparel-fashion',
  'DS Apparel Fashion',
  $desc_apparel$Lookbook-style elegant layout, emphasizing sizing charts and fabric care.$desc_apparel$,
  $html_apparel$<div class="sh-af-wrap">
  <div class="sh-af-header">
    <h1>{{title}}</h1>
  </div>
  <div class="sh-af-body">
    {{#main_image}}<div class="sh-af-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-af-content">
      {{#product_description}}<div class="sh-af-section">
        <h2>Description</h2>
        <div class="sh-af-text">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      <div class="sh-af-grid">
        {{#has_features}}<div class="sh-af-col">
          <h2>Details</h2>
          <ul class="sh-af-list">
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
        
        {{#has_details}}<div class="sh-af-col">
          <h2>Sizing & Fit</h2>
          <ul class="sh-af-list">
            {{#product_details}}<li>{{.}}</li>{{/product_details}}
          </ul>
        </div>{{/has_details}}
      </div>
      
      <div class="sh-af-alert">
        <strong>Please Note:</strong> Please refer to the sizing details above before ordering. Colors may slightly differ due to monitor settings.
      </div>
    </div>
  </div>
  <div class="sh-af-footer">
    <div class="sh-af-footer-col">
      <h3>Shipping</h3>
      <p>Orders are shipped within 2 business days. Typical delivery is 7-12 days.</p>
    </div>
    <div class="sh-af-footer-col">
      <h3>Returns</h3>
      <p>We accept returns within 30 days. Items must be unworn with tags attached.</p>
    </div>
  </div>
</div>
<style>
.sh-af-wrap { max-width: 800px; margin: 0 auto; font-family: "Helvetica Neue", Arial, sans-serif; color: #222; background: #fff; }
.sh-af-wrap img { max-width: 100%; height: auto; }
.sh-af-header { text-align: center; padding: 40px 20px; border-bottom: 1px solid #eaeaea; }
.sh-af-header h1 { margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; }
.sh-af-body { padding: 40px 20px; display: flex; flex-direction: column; align-items: center; }
.sh-af-image { margin-bottom: 40px; text-align: center; width: 100%; max-width: 500px; }
.sh-af-content { width: 100%; max-width: 600px; }
.sh-af-section { margin-bottom: 30px; text-align: center; }
.sh-af-section h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 0 0 15px 0; }
.sh-af-text { font-size: 15px; line-height: 1.6; color: #444; }
.sh-af-grid { display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px; justify-content: center; }
.sh-af-col { flex: 1 1 250px; text-align: center; }
.sh-af-col h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #666; margin: 0 0 15px 0; }
.sh-af-list { list-style: none; padding: 0; margin: 0; font-size: 14px; color: #444; }
.sh-af-list li { margin-bottom: 8px; }
.sh-af-alert { background: #fafafa; padding: 15px; text-align: center; font-size: 13px; color: #666; border: 1px solid #eaeaea; margin-bottom: 30px; }
.sh-af-footer { display: flex; flex-wrap: wrap; background: #fafafa; border-top: 1px solid #eaeaea; }
.sh-af-footer-col { flex: 1 1 250px; padding: 30px; text-align: center; }
.sh-af-footer-col h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; color: #333; }
.sh-af-footer-col p { font-size: 13px; color: #777; margin: 0; line-height: 1.5; }
</style>$html_apparel$,
  $json_apparel${
      "title": "Women's Oversized Knit Sweater Cozy Fall Winter Pullover",
      "main_image": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Chunky knit texture",
          "Oversized relaxed fit",
          "Ribbed cuffs and hem",
          "Crew neckline"
      ],
      "product_details": [
          "Material: 60% Cotton, 40% Acrylic",
          "Care: Hand wash cold, lay flat to dry",
          "Fit: True to size for an oversized look"
      ],
      "product_description": "Embrace the cold weather with our ultra-cozy oversized knit sweater. Perfect for layering over leggings or jeans for an effortlessly chic seasonal look."
  }$json_apparel$::jsonb,
  60,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 70. Beauty & Health
-- ---------------------------------------------------------------------------
(
  'ds-beauty-health',
  'DS Beauty Health',
  $desc_beauty$Spa-like, clean design with structured sections for ingredients and how-to-use.$desc_beauty$,
  $html_beauty$<div class="sh-bh-container">
  <div class="sh-bh-header">
    <h1>{{title}}</h1>
    <div class="sh-bh-divider"></div>
  </div>
  
  <div class="sh-bh-body">
    {{#main_image}}<div class="sh-bh-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-bh-info">
      {{#product_description}}<div class="sh-bh-card">
        <h2>About the Product</h2>
        <div class="sh-bh-text">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-bh-card">
        <h2>Benefits & Features</h2>
        <ul class="sh-bh-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-bh-card">
        <h2>Ingredients & Specs</h2>
        <ul class="sh-bh-list">
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-bh-guarantee">
    <div class="sh-bh-g-item">✓ 100% Authentic Quality</div>
    <div class="sh-bh-g-item">✓ Fast Processing</div>
    <div class="sh-bh-g-item">✓ 30-Day Returns</div>
  </div>
</div>
<style>
.sh-bh-container { max-width: 850px; margin: 0 auto; font-family: "Segoe UI", Roboto, Helvetica, sans-serif; background: #fff; color: #4a5568; }
.sh-bh-container img { max-width: 100%; height: auto; border-radius: 8px; }
.sh-bh-header { padding: 40px 20px 20px 20px; text-align: center; }
.sh-bh-header h1 { margin: 0; font-size: 26px; color: #2d3748; font-weight: 300; }
.sh-bh-divider { width: 60px; height: 3px; background: #4fd1c5; margin: 20px auto 0 auto; }
.sh-bh-body { display: flex; flex-wrap: wrap; gap: 40px; padding: 20px; }
.sh-bh-image { flex: 1 1 350px; text-align: center; }
.sh-bh-info { flex: 1.2 1 350px; }
.sh-bh-card { background: #f7fafc; padding: 25px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #edf2f7; }
.sh-bh-card h2 { font-size: 16px; color: #2c7a7b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0; }
.sh-bh-text { font-size: 15px; line-height: 1.6; color: #4a5568; }
.sh-bh-list { list-style: none; padding: 0; margin: 0; font-size: 15px; }
.sh-bh-list li { margin-bottom: 10px; padding-left: 20px; position: relative; }
.sh-bh-list li::before { content: "✦"; position: absolute; left: 0; color: #4fd1c5; }
.sh-bh-guarantee { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; background: #e6fffa; padding: 20px; border-radius: 12px; margin: 20px; }
.sh-bh-g-item { font-weight: 600; color: #285e61; font-size: 14px; }
@media (max-width: 768px) {
  .sh-bh-body { gap: 20px; }
  .sh-bh-guarantee { gap: 15px; flex-direction: column; align-items: center; }
}
</style>$html_beauty$,
  $json_beauty${
      "title": "Vitamin C Radiance Face Serum with Hyaluronic Acid",
      "main_image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Brightens and evens skin tone",
          "Hydrates with botanical Hyaluronic Acid",
          "Reduces the appearance of fine lines",
          "Cruelty-free and vegan formula"
      ],
      "product_details": [
          "Size: 1 fl oz / 30ml",
          "Skin Type: All skin types",
          "Key Ingredients: Vitamin C, Vitamin E, Hyaluronic Acid",
          "Formulated without: Parabens, Sulfates, Phthalates"
      ],
      "product_description": "Revitalize your skin with our potent Vitamin C serum. Designed to boost radiance and improve texture, it absorbs quickly to deliver lasting hydration and a youthful glow."
  }$json_beauty$::jsonb,
  70,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 80. Pet Supplies
-- ---------------------------------------------------------------------------
(
  'ds-pet-supplies',
  'DS Pet Supplies',
  $desc_pets$Playful yet structured layout with bright accents, focusing on material safety and sizing.$desc_pets$,
  $html_pets$<div class="sh-pt-wrap">
  <div class="sh-pt-hero">
    <h1>{{title}}</h1>
  </div>
  
  <div class="sh-pt-main">
    {{#main_image}}<div class="sh-pt-media"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-pt-grid">
      {{#product_description}}<div class="sh-pt-box">
        <h2 class="sh-pt-heading">🐾 Why They'll Love It</h2>
        <div class="sh-pt-text">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-pt-box">
        <h2 class="sh-pt-heading">🦴 Pawsome Features</h2>
        <ul class="sh-pt-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-pt-box">
        <h2 class="sh-pt-heading">📏 Specs & Sizing</h2>
        <ul class="sh-pt-list">
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
        <p class="sh-pt-note"><em>Note: Please measure your pet carefully before ordering!</em></p>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-pt-footer">
    <p><strong>Shipping:</strong> Arrives in 5-9 business days. We process orders fast so your furry friend doesn't have to wait!</p>
    <p><strong>Returns:</strong> 30 days hassle-free returns. Must be unused and in original packaging for hygiene reasons.</p>
  </div>
</div>
<style>
.sh-pt-wrap { max-width: 850px; margin: 0 auto; font-family: "Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif; background: #fffaf0; border: 3px solid #ffb020; border-radius: 15px; overflow: hidden; color: #4a4a4a; }
.sh-pt-wrap img { max-width: 100%; height: auto; border-radius: 10px; }
.sh-pt-hero { background: #ffb020; color: #fff; padding: 25px 20px; text-align: center; }
.sh-pt-hero h1 { margin: 0; font-size: 26px; font-weight: bold; text-shadow: 1px 1px 0px rgba(0,0,0,0.2); }
.sh-pt-main { padding: 30px; }
.sh-pt-media { text-align: center; margin-bottom: 30px; }
.sh-pt-grid { display: grid; gap: 20px; }
.sh-pt-box { background: #fff; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 2px dashed #ffe4b5; }
.sh-pt-heading { color: #ff8c00; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #fffaf0; padding-bottom: 10px; }
.sh-pt-text { font-family: Arial, sans-serif; font-size: 15px; line-height: 1.6; }
.sh-pt-list { font-family: Arial, sans-serif; list-style: none; padding: 0; margin: 0; font-size: 15px; }
.sh-pt-list li { margin-bottom: 8px; padding-left: 25px; position: relative; }
.sh-pt-list li::before { content: "🐕"; position: absolute; left: 0; top: 0; }
.sh-pt-note { font-family: Arial, sans-serif; font-size: 13px; color: #d2691e; margin-top: 15px; }
.sh-pt-footer { background: #fff; padding: 20px; text-align: center; font-family: Arial, sans-serif; font-size: 14px; border-top: 3px solid #ffb020; }
.sh-pt-footer p { margin: 5px 0; }
</style>$html_pets$,
  $json_pets${
      "title": "Calming Donut Dog Bed - Fluffy Anti-Anxiety Pet Cushion",
      "main_image": "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Raised rim creates a sense of security and provides head/neck support",
          "Ultra-soft vegan fur mimics a mother's coat",
          "Non-slip and dirt-resistant bottom",
          "Machine washable and dryer safe"
      ],
      "product_details": [
          "Size: Medium (23x23 inches)",
          "Recommended for: Pets up to 25 lbs",
          "Material: Faux Shag Fur, PP Cotton filling",
          "Colors: Grey, Brown, Pink"
      ],
      "product_description": "Give your best friend the gift of better sleep. Our calming donut bed is designed to ease anxiety and provide unparalleled comfort for dogs and cats alike."
  }$json_pets$::jsonb,
  80,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 90. Fitness Sports
-- ---------------------------------------------------------------------------
(
  'ds-fitness-sports',
  'DS Fitness Sports',
  $desc_fitness$High-energy, bold typography layout focusing on durability, materials, and active lifestyle.$desc_fitness$,
  $html_fitness$<div class="sh-fs-wrap">
  <div class="sh-fs-hero">
    <h1>{{title}}</h1>
  </div>
  
  <div class="sh-fs-stats">
    <div class="sh-fs-stat">HIGH QUALITY</div>
    <div class="sh-fs-stat">DURABLE</div>
    <div class="sh-fs-stat">FAST SHIPPING</div>
  </div>

  <div class="sh-fs-content">
    {{#main_image}}<div class="sh-fs-img"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    {{#product_description}}<div class="sh-fs-section">
      <h2>// DESCRIPTION</h2>
      <div class="sh-fs-prose">{{{product_description}}}</div>
    </div>{{/product_description}}
    
    <div class="sh-fs-flex">
      {{#has_features}}<div class="sh-fs-col">
        <h2>// FEATURES</h2>
        <ul class="sh-fs-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-fs-col">
        <h2>// SPECIFICATIONS</h2>
        <table class="sh-fs-table">
          <tbody>
            {{#product_details}}<tr><td>{{.}}</td></tr>{{/product_details}}
          </tbody>
        </table>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-fs-footer">
    <p><strong>DELIVERY:</strong> Fast dispatch. 5-8 business days standard transit.</p>
    <p><strong>GUARANTEE:</strong> 30-Day Money Back Guarantee. Train with confidence.</p>
  </div>
</div>
<style>
.sh-fs-wrap { max-width: 900px; margin: 0 auto; font-family: "Impact", "Arial Black", sans-serif; background: #fff; color: #000; border: 4px solid #000; text-transform: uppercase; }
.sh-fs-wrap img { max-width: 100%; height: auto; display: block; border: 2px solid #000; }
.sh-fs-hero { background: #ecfeff; padding: 30px; text-align: center; border-bottom: 4px solid #000; }
.sh-fs-hero h1 { margin: 0; font-size: 32px; letter-spacing: 1px; color: #0891b2; }
.sh-fs-stats { display: flex; border-bottom: 4px solid #000; background: #000; color: #06b6d4; }
.sh-fs-stat { flex: 1; text-align: center; padding: 15px; font-size: 18px; border-right: 2px solid #333; }
.sh-fs-stat:last-child { border-right: none; }
.sh-fs-content { padding: 30px; }
.sh-fs-img { margin-bottom: 40px; }
.sh-fs-section { margin-bottom: 40px; }
.sh-fs-section h2, .sh-fs-col h2 { font-size: 22px; color: #0891b2; margin: 0 0 15px 0; }
.sh-fs-prose { font-family: Arial, sans-serif; text-transform: none; font-size: 16px; line-height: 1.5; font-weight: bold; }
.sh-fs-flex { display: flex; flex-wrap: wrap; gap: 40px; }
.sh-fs-col { flex: 1 1 300px; }
.sh-fs-list { font-family: Arial, sans-serif; text-transform: none; list-style: none; padding: 0; margin: 0; font-weight: bold; font-size: 15px; }
.sh-fs-list li { margin-bottom: 10px; padding-left: 20px; position: relative; }
.sh-fs-list li::before { content: "►"; position: absolute; left: 0; color: #06b6d4; font-size: 12px; top: 2px; }
.sh-fs-table { font-family: Arial, sans-serif; text-transform: none; width: 100%; border-collapse: collapse; font-weight: bold; font-size: 14px; }
.sh-fs-table td { padding: 10px 0; border-bottom: 2px solid #eee; }
.sh-fs-footer { background: #f3f4f6; padding: 20px 30px; border-top: 4px solid #000; font-family: Arial, sans-serif; text-transform: none; }
.sh-fs-footer p { margin: 5px 0; font-size: 15px; }
@media (max-width: 600px) {
  .sh-fs-stats { flex-direction: column; }
  .sh-fs-stat { border-right: none; border-bottom: 1px solid #333; }
}
</style>$html_fitness$,
  $json_fitness${
      "title": "Adjustable Dumbbell Set 50lbs with Non-Slip Grip",
      "main_image": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Quick-adjust weight mechanism",
          "Replaces 15 sets of weights",
          "Textured knurled grip for safety",
          "Space-saving compact design"
      ],
      "product_details": [
          "Weight Range: 5 to 50 lbs",
          "Increments: 2.5 lb adjustments",
          "Material: Steel core with premium coating",
          "Included: 1 Dumbbell, 1 Base Tray"
      ],
      "product_description": "Maximize your home workouts with this versatile adjustable dumbbell. Seamlessly switch from light raises to heavy squats with a simple turn of the dial."
  }$json_fitness$::jsonb,
  90,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 100. Outdoor Survival
-- ---------------------------------------------------------------------------
(
  'ds-outdoor-survival',
  'DS Outdoor Survival',
  $desc_outdoor$Rugged earth tones layout with a focus on weather-resistance specs and durability.$desc_outdoor$,
  $html_outdoor$<div class="sh-os-wrap">
  <div class="sh-os-header">
    <h1>{{title}}</h1>
  </div>
  
  <div class="sh-os-body">
    <div class="sh-os-warning">TESTED FOR THE TOUGHEST CONDITIONS</div>
    
    {{#main_image}}<div class="sh-os-media"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-os-grid">
      <div class="sh-os-primary">
        {{#product_description}}<div class="sh-os-card">
          <h2>Overview</h2>
          <div class="sh-os-prose">{{{product_description}}}</div>
        </div>{{/product_description}}
        
        {{#has_features}}<div class="sh-os-card">
          <h2>Key Features</h2>
          <ul class="sh-os-list">
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
      </div>
      
      <div class="sh-os-secondary">
        {{#has_details}}<div class="sh-os-card sh-os-dark">
          <h2>Specifications</h2>
          <ul class="sh-os-specs">
            {{#product_details}}<li>{{.}}</li>{{/product_details}}
          </ul>
        </div>{{/has_details}}
        
        <div class="sh-os-card">
          <h2>Service Guarantee</h2>
          <p><strong>Logistics:</strong> Fast processing, tracking provided. 5-10 Days delivery.</p>
          <p><strong>Returns:</strong> 30 Days money back if the gear doesn't meet your standards.</p>
        </div>
      </div>
    </div>
  </div>
</div>
<style>
.sh-os-wrap { max-width: 900px; margin: 0 auto; font-family: "Trebuchet MS", "Lucida Grande", sans-serif; background: #e5e5e0; color: #2c3e2c; border: 1px solid #c2c2b6; }
.sh-os-wrap img { max-width: 100%; height: auto; display: block; border-radius: 4px; }
.sh-os-header { background: #3b4d3b; color: #f4f4f0; padding: 25px; text-align: center; border-bottom: 5px solid #8b7355; }
.sh-os-header h1 { margin: 0; font-size: 26px; text-transform: uppercase; letter-spacing: 1px; }
.sh-os-warning { background: #8b7355; color: #fff; text-align: center; padding: 10px; font-weight: bold; font-size: 14px; letter-spacing: 2px; }
.sh-os-body { padding: 20px; }
.sh-os-media { margin-bottom: 20px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
.sh-os-grid { display: flex; flex-wrap: wrap; gap: 20px; }
.sh-os-primary { flex: 2 1 400px; }
.sh-os-secondary { flex: 1 1 250px; }
.sh-os-card { background: #f4f4f0; padding: 20px; margin-bottom: 20px; border-radius: 4px; border: 1px solid #d2d2c6; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
.sh-os-dark { background: #2c3e2c; color: #e5e5e0; border-color: #1a251a; }
.sh-os-card h2 { margin: 0 0 15px 0; font-size: 18px; text-transform: uppercase; border-bottom: 2px solid #8b7355; padding-bottom: 5px; }
.sh-os-dark h2 { color: #dcb88c; border-bottom-color: #4a5d4a; }
.sh-os-prose { line-height: 1.6; font-size: 15px; }
.sh-os-list { list-style: none; padding: 0; margin: 0; }
.sh-os-list li { margin-bottom: 10px; padding-left: 20px; position: relative; }
.sh-os-list li::before { content: "»"; position: absolute; left: 0; color: #8b7355; font-weight: bold; font-size: 18px; line-height: 1; }
.sh-os-specs { list-style: none; padding: 0; margin: 0; font-size: 14px; }
.sh-os-specs li { padding: 8px 0; border-bottom: 1px dashed #4a5d4a; }
.sh-os-card p { font-size: 14px; margin-bottom: 10px; line-height: 1.5; }
</style>$html_outdoor$,
  $json_outdoor${
      "title": "Tactical Waterproof Backpack 45L Military MOLLE Bug Out Bag",
      "main_image": "https://images.unsplash.com/photo-1622260614153-03223fb72052?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Heavy-duty 900D Oxford waterproof fabric",
          "MOLLE webbing system for attaching extra gear",
          "Double-stitched, heavy-duty zippers",
          "Ventilated mesh padded back area and shoulder straps"
      ],
      "product_details": [
          "Capacity: 45L",
          "Dimensions: 19\" x 11\" x 11\"",
          "Weight: 2.7 lbs",
          "Hydration Compatible: Yes (bladder not included)"
      ],
      "product_description": "Built for the harshest environments. Whether you are trekking, camping, or building a 72-hour bug out bag, this 45L tactical backpack provides the durability and space you need."
  }$json_outdoor$::jsonb,
  100,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 110. Toys & Kids
-- ---------------------------------------------------------------------------
(
  'ds-toys-kids',
  'DS Toys Kids',
  $desc_toys$Fun, safe, and brightly colored layout with prominent age-recommendation and safety warning blocks.$desc_toys$,
  $html_toys$<div class="sh-tk-container">
  <div class="sh-tk-header">
    <h1>{{title}}</h1>
  </div>
  
  <div class="sh-tk-content">
    {{#main_image}}<div class="sh-tk-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-tk-info">
      <div class="sh-tk-badge-row">
        <span class="sh-tk-badge sh-tk-badge-age">Ages 3+</span>
        <span class="sh-tk-badge sh-tk-badge-safe">Non-Toxic</span>
        <span class="sh-tk-badge sh-tk-badge-gift">Great Gift!</span>
      </div>
      
      {{#product_description}}<div class="sh-tk-box">
        <h2>About This Toy</h2>
        <div class="sh-tk-text">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-tk-box">
        <h2>Fun Features</h2>
        <ul class="sh-tk-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-tk-box">
        <h2>Product Details</h2>
        <ul class="sh-tk-list">
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-tk-footer">
    <div class="sh-tk-footer-item">
      <h3>🚀 Fast Shipping</h3>
      <p>We ship quickly so the fun can begin! Tracking provided.</p>
    </div>
    <div class="sh-tk-footer-item">
      <h3>😊 Happy Returns</h3>
      <p>If you or your little one aren't completely happy, return it within 30 days.</p>
    </div>
  </div>
</div>
<style>
.sh-tk-container { max-width: 850px; margin: 0 auto; font-family: "Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif; background: #fff; border: 4px solid #ff6b6b; border-radius: 20px; overflow: hidden; color: #333; }
.sh-tk-container img { max-width: 100%; height: auto; border-radius: 12px; }
.sh-tk-header { background: #ff6b6b; color: #fff; padding: 25px 20px; text-align: center; }
.sh-tk-header h1 { margin: 0; font-size: 28px; }
.sh-tk-content { padding: 30px; display: flex; flex-wrap: wrap; gap: 30px; }
.sh-tk-image { flex: 1 1 300px; text-align: center; }
.sh-tk-info { flex: 1.5 1 350px; }
.sh-tk-badge-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.sh-tk-badge { padding: 8px 15px; border-radius: 20px; font-weight: bold; font-size: 14px; color: #fff; }
.sh-tk-badge-age { background: #4ecdc4; }
.sh-tk-badge-safe { background: #a8e6cf; color: #333; }
.sh-tk-badge-gift { background: #ffe66d; color: #333; }
.sh-tk-box { margin-bottom: 25px; background: #f9f9f9; padding: 20px; border-radius: 15px; border: 2px dashed #ff6b6b; }
.sh-tk-box h2 { color: #ff6b6b; margin: 0 0 15px 0; font-size: 20px; }
.sh-tk-text { font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; }
.sh-tk-list { font-family: Arial, sans-serif; list-style: none; padding: 0; margin: 0; font-size: 15px; }
.sh-tk-list li { margin-bottom: 10px; padding-left: 30px; position: relative; }
.sh-tk-list li::before { content: "⭐"; position: absolute; left: 0; top: 0; }
.sh-tk-footer { display: flex; flex-wrap: wrap; background: #ffe66d; border-top: 4px solid #ff6b6b; }
.sh-tk-footer-item { flex: 1 1 250px; padding: 20px; text-align: center; }
.sh-tk-footer-item h3 { color: #ff6b6b; margin: 0 0 10px 0; }
.sh-tk-footer-item p { font-family: Arial, sans-serif; font-size: 14px; margin: 0; }
</style>$html_toys$,
  $json_toys${
      "title": "Educational Wooden Building Blocks Set - 100 Pieces",
      "main_image": "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Promotes spatial awareness and creativity",
          "Smooth edges, safe for little hands",
          "Painted with non-toxic, water-based paints",
          "Includes a convenient storage bucket"
      ],
      "product_details": [
          "Material: Premium Beech Wood",
          "Piece Count: 100 blocks of various shapes",
          "Recommended Age: 3 Years and Up",
          "Safety Certification: ASTM F963"
      ],
      "product_description": "Spark your child's imagination! This classic 100-piece wooden block set helps develop motor skills, color recognition, and early math concepts through fun, hands-on play."
  }$json_toys$::jsonb,
  110,
  TRUE
),

-- ---------------------------------------------------------------------------
-- 120. Kitchen & Dining
-- ---------------------------------------------------------------------------
(
  'ds-kitchen-dining',
  'DS Kitchen Dining',
  $desc_kitchen$Recipe and lifestyle-focused layout, emphasizing food-grade safety and care instructions.$desc_kitchen$,
  $html_kitchen$<div class="sh-kd-wrap">
  <div class="sh-kd-header">
    <div class="sh-kd-header-inner">
      <h1>{{title}}</h1>
    </div>
  </div>
  
  <div class="sh-kd-main">
    <div class="sh-kd-icons">
      <div class="sh-kd-icon">🍽️ Food Safe</div>
      <div class="sh-kd-icon">✨ Easy Clean</div>
      <div class="sh-kd-icon">🚚 Free Shipping</div>
    </div>
    
    {{#main_image}}<div class="sh-kd-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-kd-grid">
      {{#product_description}}<div class="sh-kd-card">
        <h2>Description</h2>
        <div class="sh-kd-prose">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-kd-card">
        <h2>Key Features</h2>
        <ul class="sh-kd-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-kd-card">
        <h2>Specifications & Care</h2>
        <ul class="sh-kd-list">
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-kd-footer">
    <div class="sh-kd-footer-box">
      <strong>Shipping Policy:</strong> Standard shipping takes 5-9 business days. All items are packed securely.
    </div>
    <div class="sh-kd-footer-box">
      <strong>Return Policy:</strong> Returns accepted within 30 days. Item must be unused and in original packaging.
    </div>
  </div>
</div>
<style>
.sh-kd-wrap { max-width: 850px; margin: 0 auto; font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #fff; color: #444; border: 1px solid #e0e0e0; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.sh-kd-wrap img { max-width: 100%; height: auto; display: block; border-radius: 8px; }
.sh-kd-header { background: #fdfbf7; padding: 40px 20px; text-align: center; border-bottom: 2px solid #e87a5d; }
.sh-kd-header h1 { margin: 0; font-size: 28px; color: #333; font-weight: normal; }
.sh-kd-main { padding: 30px; background: #fff; }
.sh-kd-icons { display: flex; justify-content: center; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
.sh-kd-icon { background: #f4f4f4; padding: 8px 15px; border-radius: 20px; font-size: 14px; font-weight: 600; color: #555; }
.sh-kd-image { text-align: center; margin-bottom: 40px; }
.sh-kd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px; }
.sh-kd-card { background: #fdfbf7; padding: 25px; border-radius: 8px; border: 1px solid #f0ebe1; }
.sh-kd-card h2 { font-size: 18px; color: #e87a5d; margin: 0 0 15px 0; padding-bottom: 10px; border-bottom: 1px solid #f0ebe1; }
.sh-kd-prose { font-size: 15px; line-height: 1.6; }
.sh-kd-list { list-style: none; padding: 0; margin: 0; font-size: 15px; }
.sh-kd-list li { margin-bottom: 10px; padding-left: 20px; position: relative; }
.sh-kd-list li::before { content: "✓"; position: absolute; left: 0; color: #e87a5d; font-weight: bold; }
.sh-kd-footer { display: flex; flex-wrap: wrap; border-top: 1px solid #e0e0e0; background: #fafafa; }
.sh-kd-footer-box { flex: 1 1 300px; padding: 20px; font-size: 14px; line-height: 1.5; color: #666; border-right: 1px solid #e0e0e0; }
.sh-kd-footer-box:last-child { border-right: none; }
@media (max-width: 600px) {
  .sh-kd-footer-box { border-right: none; border-bottom: 1px solid #e0e0e0; }
}
</style>$html_kitchen$,
  $json_kitchen${
      "title": "Professional Damascus Steel Chef Knife 8 Inch",
      "main_image": "https://images.unsplash.com/photo-1593998066526-65fcab3021a2?auto=format&fit=crop&q=80&w=800",
      "has_details": "1",
      "has_features": "1",
      "feature_bullets": [
          "Forged from 67 layers of high-carbon Damascus steel",
          "Ultra-sharp edge retention",
          "Ergonomic G10 handle for comfort and control",
          "Beautiful ripple pattern on the blade"
      ],
      "product_details": [
          "Blade Length: 8 inches",
          "Handle Material: G10 Military Grade",
          "Hardness: 60±2 HRC",
          "Care: Hand wash only, dry immediately"
      ],
      "product_description": "Elevate your culinary skills with a knife designed for precision and durability. Whether you're slicing meat or dicing vegetables, this chef's knife delivers professional performance in every cut."
  }$json_kitchen$::jsonb,
  120,
  TRUE
);
