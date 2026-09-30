-- apps/api/migrations/126_dropshipping_templates_catalog_seasonal.sql
-- Adds 4 new seasonal dropshipping-specific templates (Mother's Day, Valentine's Day, Father's Day, Back to School).

INSERT INTO predefined_templates (slug, name, description, html_content, sample_data, sort_order, is_active) VALUES

-- ---------------------------------------------------------------------------
-- 13. Mother's Day
-- ---------------------------------------------------------------------------
(
  'valentines-day',
  'Valentine''s Day',
  $desc_valentines_day$An elegant, warm, and floral-inspired layout perfect for Mother's Day gifts and premium sets.$desc_valentines_day$,
  $html_valentines_day$<div class="sh-md-container">
  <div class="sh-md-header">
    <div class="sh-md-brand">PREMIUM GIFT COLLECTION</div>
    <h1>{{title}}</h1>
    <div class="sh-md-divider"></div>
  </div>
  
  <div class="sh-md-body">
    {{#main_image}}<div class="sh-md-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-md-info">
      {{#product_description}}<div class="sh-md-card">
        <h2>About the Gift</h2>
        <div class="sh-md-text">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-md-card">
        <h2>Why They'll Love It</h2>
        <ul class="sh-md-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-md-card">
        <h2>Gift Specifications</h2>
        <ul class="sh-md-list">
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-md-guarantee">
    <div class="sh-md-g-item">♡ Beautifully Packaged</div>
    <div class="sh-md-g-item">♡ Premium Quality</div>
    <div class="sh-md-g-item">♡ Fast Delivery</div>
  </div>
</div>
<style>
.sh-md-container { max-width: 900px; margin: 0 auto; font-family: "Georgia", serif; background: #fffcfdf; color: #4a3b3c; border: 1px solid #f2e1e3; border-radius: 4px; }
.sh-md-container img { max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
.sh-md-header { padding: 45px 20px 30px; text-align: center; background: #faf0f2; border-bottom: 1px solid #f2e1e3; }
.sh-md-brand { font-size: 12px; letter-spacing: 3px; color: #a37c82; text-transform: uppercase; margin-bottom: 15px; font-family: "Helvetica Neue", sans-serif; }
.sh-md-header h1 { margin: 0; font-size: 28px; color: #5a4144; font-weight: normal; line-height: 1.3; }
.sh-md-divider { width: 40px; height: 2px; background: #d9aeb4; margin: 25px auto 0; }
.sh-md-body { display: flex; flex-wrap: wrap; gap: 40px; padding: 40px 30px; }
.sh-md-image { flex: 1 1 400px; text-align: center; }
.sh-md-info { flex: 1.2 1 350px; }
.sh-md-card { margin-bottom: 30px; }
.sh-md-card h2 { font-size: 18px; color: #a37c82; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 15px 0; font-family: "Helvetica Neue", sans-serif; }
.sh-md-text { font-size: 16px; line-height: 1.7; color: #5a4144; font-family: "Helvetica Neue", sans-serif; }
.sh-md-list { list-style: none; padding: 0; margin: 0; font-size: 15px; font-family: "Helvetica Neue", sans-serif; }
.sh-md-list li { margin-bottom: 12px; padding-left: 20px; position: relative; color: #5a4144; }
.sh-md-list li::before { content: "♥"; position: absolute; left: 0; color: #d9aeb4; font-size: 12px; top: 2px; }
.sh-md-guarantee { display: flex; justify-content: center; gap: 40px; flex-wrap: wrap; background: #faf0f2; padding: 25px; border-top: 1px solid #f2e1e3; }
.sh-md-g-item { font-weight: 500; color: #a37c82; font-size: 14px; font-family: "Helvetica Neue", sans-serif; letter-spacing: 1px; text-transform: uppercase; }
@media (max-width: 768px) {
  .sh-md-body { padding: 25px 20px; gap: 25px; }
  .sh-md-guarantee { gap: 15px; flex-direction: column; align-items: center; padding: 20px; }
}
</style>$html_valentines_day$,
  '{"title": "Luxury Spa Gift Basket with Essential Oils", "main_image": "/template-samples/mothers-day.jpg", "has_features": "1", "has_details": "1", "feature_bullets": ["Nourishing rose and jasmine essential oils", "Hand-poured aromatic soy candle", "Rich hydrating body butter", "Comes in a beautiful woven gift basket"], "product_details": ["Brand: Unbranded", "Type: Spa Gift Set", "Scent: Rose & Jasmine", "Target Audience: Women"], "product_description": "Give the gift of pure relaxation. This carefully curated spa basket features soothing essential oils, a glowing candle, and rich body butter, all elegantly packaged and ready to delight."}'::jsonb,
  130,
  true
),

-- ---------------------------------------------------------------------------
-- 14. Valentine's Day
-- ---------------------------------------------------------------------------
(
  'general-store-alt-2',
  'General Store Alt 2',
  $desc_general_store_alt_2$A romantic, deeply elegant design featuring rich colors, ideal for Valentine's Day specials.$desc_general_store_alt_2$,
  $html_general_store_alt_2$<div class="sh-vd-container">
  <div class="sh-vd-hero">
    <h1>{{title}}</h1>
    <p>A gift to remember.</p>
  </div>
  
  <div class="sh-vd-body">
    {{#main_image}}<div class="sh-vd-image"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-vd-content">
      {{#product_description}}<div class="sh-vd-section">
        <h2>The Perfect Expression</h2>
        <div class="sh-vd-text">{{{product_description}}}</div>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-vd-section">
        <h2>Special Highlights</h2>
        <ul class="sh-vd-list">
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-vd-section">
        <h2>Details</h2>
        <ul class="sh-vd-details-list">
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-vd-footer">
    <div class="sh-vd-footer-inner">
      <span>★ Fast Shipping</span>
      <span>★ Secure Checkout</span>
      <span>★ 30-Day Returns</span>
    </div>
  </div>
</div>
<style>
.sh-vd-container { max-width: 850px; margin: 0 auto; font-family: "Helvetica Neue", Arial, sans-serif; background: #fff; color: #333; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.sh-vd-container img { max-width: 100%; height: auto; border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.sh-vd-hero { background: #5c0f1b; color: #fff; text-align: center; padding: 50px 20px; }
.sh-vd-hero h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 300; letter-spacing: 1px; font-family: "Georgia", serif; }
.sh-vd-hero p { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; color: #f2c7cc; }
.sh-vd-body { display: flex; flex-wrap: wrap; gap: 40px; padding: 40px; }
.sh-vd-image { flex: 1 1 350px; text-align: center; margin-top: -80px; }
.sh-vd-content { flex: 1 1 350px; }
.sh-vd-section { margin-bottom: 35px; }
.sh-vd-section h2 { font-size: 16px; color: #5c0f1b; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 15px 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.sh-vd-text { font-size: 15px; line-height: 1.8; color: #555; }
.sh-vd-list { list-style: none; padding: 0; margin: 0; font-size: 15px; }
.sh-vd-list li { margin-bottom: 10px; padding-left: 20px; position: relative; color: #444; }
.sh-vd-list li::before { content: "›"; position: absolute; left: 0; color: #c42d40; font-size: 18px; font-weight: bold; top: -2px; }
.sh-vd-details-list { list-style: square; padding-left: 20px; margin: 0; font-size: 14px; color: #666; }
.sh-vd-details-list li { margin-bottom: 6px; }
.sh-vd-footer { background: #fafafa; border-top: 1px solid #eee; padding: 25px 20px; }
.sh-vd-footer-inner { display: flex; justify-content: space-around; flex-wrap: wrap; max-width: 600px; margin: 0 auto; color: #c42d40; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; }
@media (max-width: 768px) {
  .sh-vd-image { margin-top: 0; }
  .sh-vd-body { padding: 20px; gap: 30px; }
  .sh-vd-footer-inner { flex-direction: column; align-items: center; gap: 15px; }
}
</style>$html_general_store_alt_2$,
  '{"title": "Preserved Red Rose in Glass Dome with LED Lights", "main_image": "/template-samples/valentines-day.jpg", "has_features": "1", "has_details": "1", "feature_bullets": ["Real preserved rose that lasts for years", "Warm fairy LED lights for a magical glow", "Elegant glass dome display", "A timeless symbol of love"], "product_details": ["Brand: Unbranded", "Material: Glass, Preserved Flower, Wood", "Power: AAA Batteries (not included)", "Color: Deep Red"], "product_description": "Express your love with a symbol that endures. This stunning preserved red rose is encased in a premium glass dome and illuminated by soft fairy lights, creating a romantic and unforgettable display."}'::jsonb,
  140,
  true
),

-- ---------------------------------------------------------------------------
-- 15. Father's Day
-- ---------------------------------------------------------------------------
(
  'general-store-alt-3',
  'General Store Alt 3',
  $desc_general_store_alt_3$A strong, bold, and classic layout designed for Father's Day gifts, tools, and accessories.$desc_general_store_alt_3$,
  $html_general_store_alt_3$<div class="sh-fd-container">
  <div class="sh-fd-header">
    <h1>{{title}}</h1>
    <div class="sh-fd-badges">
      <span>FAST DISPATCH</span>
      <span>PREMIUM BUILD</span>
      <span>30-DAY RETURN</span>
    </div>
  </div>
  
  <div class="sh-fd-layout">
    {{#main_image}}<div class="sh-fd-photo"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
    
    <div class="sh-fd-specs">
      {{#product_description}}<div class="sh-fd-block">
        <h3>Description</h3>
        <p>{{{product_description}}}</p>
      </div>{{/product_description}}
      
      {{#has_features}}<div class="sh-fd-block">
        <h3>Key Features</h3>
        <ul>
          {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
        </ul>
      </div>{{/has_features}}
      
      {{#has_details}}<div class="sh-fd-block">
        <h3>Specifications</h3>
        <ul>
          {{#product_details}}<li>{{.}}</li>{{/product_details}}
        </ul>
      </div>{{/has_details}}
    </div>
  </div>
  
  <div class="sh-fd-policies">
    <div class="sh-fd-policy">
      <h4>Shipping</h4>
      <p>Orders ship within 1-2 business days with tracking included.</p>
    </div>
    <div class="sh-fd-policy">
      <h4>Returns</h4>
      <p>Hassle-free 30-day money back guarantee if you are not satisfied.</p>
    </div>
  </div>
</div>
<style>
.sh-fd-container { max-width: 880px; margin: 0 auto; font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #1a1a1a; border: 2px solid #2d3748; }
.sh-fd-container img { max-width: 100%; height: auto; border: 1px solid #e2e8f0; }
.sh-fd-header { background: #2d3748; color: #fff; padding: 40px 20px; text-align: center; }
.sh-fd-header h1 { margin: 0 0 20px 0; font-size: 28px; font-weight: 700; text-transform: uppercase; letter-spacing: -0.5px; }
.sh-fd-badges { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
.sh-fd-badges span { font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 4px 10px; background: #4a5568; border-radius: 2px; }
.sh-fd-layout { display: flex; flex-wrap: wrap; gap: 0; border-bottom: 2px solid #2d3748; }
.sh-fd-photo { flex: 1 1 400px; padding: 30px; background: #f7fafc; display: flex; align-items: center; justify-content: center; }
.sh-fd-specs { flex: 1.2 1 400px; padding: 30px; border-left: 2px solid #2d3748; }
.sh-fd-block { margin-bottom: 30px; }
.sh-fd-block:last-child { margin-bottom: 0; }
.sh-fd-block h3 { margin: 0 0 12px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; color: #2d3748; display: inline-block; border-bottom: 3px solid #cbd5e0; padding-bottom: 4px; }
.sh-fd-block p { margin: 0; font-size: 15px; line-height: 1.6; color: #4a5568; }
.sh-fd-block ul { list-style: none; padding: 0; margin: 0; font-size: 15px; color: #4a5568; }
.sh-fd-block ul li { margin-bottom: 8px; padding-left: 18px; position: relative; }
.sh-fd-block ul li::before { content: "■"; position: absolute; left: 0; color: #718096; font-size: 10px; top: 5px; }
.sh-fd-policies { display: flex; flex-wrap: wrap; background: #edf2f7; }
.sh-fd-policy { flex: 1 1 300px; padding: 25px 30px; }
.sh-fd-policy:first-child { border-right: 2px solid #2d3748; }
.sh-fd-policy h4 { margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; font-weight: 800; color: #2d3748; }
.sh-fd-policy p { margin: 0; font-size: 13px; color: #4a5568; line-height: 1.5; }
@media (max-width: 768px) {
  .sh-fd-specs { border-left: none; border-top: 2px solid #2d3748; padding: 20px; }
  .sh-fd-photo { padding: 20px; }
  .sh-fd-policy:first-child { border-right: none; border-bottom: 2px solid #2d3748; }
}
</style>$html_general_store_alt_3$,
  '{"title": "Personalized Leather Wallet & Key Fob Gift Set", "main_image": "/template-samples/fathers-day.jpg", "has_features": "1", "has_details": "1", "feature_bullets": ["Genuine premium brown leather", "Classic bi-fold design with card slots", "Matching leather key fob included", "Durable stitching for everyday use"], "product_details": ["Brand: Unbranded", "Material: Genuine Leather", "Style: Bi-fold", "Color: Brown"], "product_description": "Upgrade his everyday essentials. Crafted from high-quality genuine leather, this classic bi-fold wallet and matching key fob set is designed to age beautifully and stand the test of time."}'::jsonb,
  150,
  true
),

-- ---------------------------------------------------------------------------
-- 16. Back to School
-- ---------------------------------------------------------------------------
(
  'back-to-school',
  'Back to School',
  $desc_back_to_school$A dynamic and clean design perfect for student gear, backpacks, and back-to-school essentials.$desc_back_to_school$,
  $html_back_to_school$<div class="sh-bs-wrapper">
  <div class="sh-bs-topbar">READY FOR THE SCHOOL YEAR</div>
  
  <div class="sh-bs-content-area">
    <h1 class="sh-bs-title">{{title}}</h1>
    
    <div class="sh-bs-flex">
      {{#main_image}}<div class="sh-bs-img-wrap"><img src="{{.}}" alt="{{title}}"></div>{{/main_image}}
      
      <div class="sh-bs-text-wrap">
        {{#product_description}}<p class="sh-bs-desc">{{{product_description}}}</p>{{/product_description}}
        
        {{#has_features}}<div class="sh-bs-box">
          <h3>Top Features</h3>
          <ul class="sh-bs-check-list">
            {{#feature_bullets}}<li>{{.}}</li>{{/feature_bullets}}
          </ul>
        </div>{{/has_features}}
        
        {{#has_details}}<div class="sh-bs-box sh-bs-box-alt">
          <h3>Product Specs</h3>
          <ul class="sh-bs-dot-list">
            {{#product_details}}<li>{{.}}</li>{{/product_details}}
          </ul>
        </div>{{/has_details}}
      </div>
    </div>
  </div>
  
  <div class="sh-bs-footer">
    <div><strong>Shipping:</strong> Standard delivery arrives in 3-5 business days.</div>
    <div><strong>Returns:</strong> Easy 30-day returns for unused items.</div>
  </div>
</div>
<style>
.sh-bs-wrapper { max-width: 900px; margin: 0 auto; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 5px 25px rgba(0,0,0,0.05); }
.sh-bs-wrapper img { max-width: 100%; height: auto; border-radius: 8px; }
.sh-bs-topbar { background: #ffd166; color: #118ab2; font-weight: bold; text-align: center; padding: 10px; font-size: 14px; letter-spacing: 2px; }
.sh-bs-content-area { padding: 40px 30px; }
.sh-bs-title { margin: 0 0 30px 0; font-size: 26px; color: #073b4c; font-weight: 800; text-align: center; line-height: 1.3; }
.sh-bs-flex { display: flex; flex-wrap: wrap; gap: 40px; }
.sh-bs-img-wrap { flex: 1 1 350px; text-align: center; }
.sh-bs-text-wrap { flex: 1 1 350px; }
.sh-bs-desc { font-size: 16px; line-height: 1.6; color: #444; margin: 0 0 25px 0; }
.sh-bs-box { background: #f8f9fa; border-left: 4px solid #ef476f; padding: 20px; margin-bottom: 20px; border-radius: 0 8px 8px 0; }
.sh-bs-box-alt { border-left-color: #118ab2; }
.sh-bs-box h3 { margin: 0 0 15px 0; font-size: 16px; color: #073b4c; text-transform: uppercase; }
.sh-bs-check-list { list-style: none; padding: 0; margin: 0; }
.sh-bs-check-list li { margin-bottom: 10px; padding-left: 24px; position: relative; font-size: 15px; color: #333; }
.sh-bs-check-list li::before { content: "✓"; position: absolute; left: 0; color: #ef476f; font-weight: bold; }
.sh-bs-dot-list { list-style: disc; padding-left: 20px; margin: 0; font-size: 14px; color: #555; }
.sh-bs-dot-list li { margin-bottom: 8px; }
.sh-bs-footer { background: #073b4c; color: #fff; padding: 20px 30px; font-size: 13px; text-align: center; }
.sh-bs-footer div { margin-bottom: 10px; }
.sh-bs-footer div:last-child { margin-bottom: 0; }
@media (max-width: 768px) {
  .sh-bs-content-area { padding: 25px 20px; }
  .sh-bs-title { font-size: 22px; margin-bottom: 20px; }
  .sh-bs-flex { gap: 25px; }
  .sh-bs-footer { flex-direction: column; text-align: center; }
}
</style>$html_back_to_school$,
  '{"title": "Ergonomic Student Backpack with USB Charging Port", "main_image": "/template-samples/back-to-school.jpg", "has_features": "1", "has_details": "1", "feature_bullets": ["Built-in USB charging port for on-the-go power", "Ergonomic padded shoulder straps", "Spacious main compartment for books and laptop", "Water-resistant exterior material"], "product_details": ["Brand: Unbranded", "Material: Polyester", "Features: USB Port, Laptop Sleeve", "Color: Blue and Yellow"], "product_description": "Carry your gear comfortably and stay powered up all day. Featuring a built-in USB charging port, padded straps, and plenty of space, this bright and durable backpack is essential for the active student."}'::jsonb,
  160,
  true
);

/*
$template_samples$
{
  "valentines-day": {
    "title": "Luxury Spa Gift Basket with Essential Oils",
    "main_image": "/template-samples/mothers-day.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Nourishing rose and jasmine essential oils",
      "Hand-poured aromatic soy candle",
      "Rich hydrating body butter",
      "Comes in a beautiful woven gift basket"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Type: Spa Gift Set",
      "Scent: Rose & Jasmine",
      "Target Audience: Women"
    ],
    "product_description": "Give the gift of pure relaxation. This carefully curated spa basket features soothing essential oils, a glowing candle, and rich body butter, all elegantly packaged and ready to delight."
  },
  "general-store-alt-2": {
    "title": "Preserved Red Rose in Glass Dome with LED Lights",
    "main_image": "/template-samples/valentines-day.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Real preserved rose that lasts for years",
      "Warm fairy LED lights for a magical glow",
      "Elegant glass dome display",
      "A timeless symbol of love"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Glass, Preserved Flower, Wood",
      "Power: AAA Batteries (not included)",
      "Color: Deep Red"
    ],
    "product_description": "Express your love with a symbol that endures. This stunning preserved red rose is encased in a premium glass dome and illuminated by soft fairy lights, creating a romantic and unforgettable display."
  },
  "general-store-alt-3": {
    "title": "Personalized Leather Wallet & Key Fob Gift Set",
    "main_image": "/template-samples/fathers-day.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Genuine premium brown leather",
      "Classic bi-fold design with card slots",
      "Matching leather key fob included",
      "Durable stitching for everyday use"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Genuine Leather",
      "Style: Bi-fold",
      "Color: Brown"
    ],
    "product_description": "Upgrade his everyday essentials. Crafted from high-quality genuine leather, this classic bi-fold wallet and matching key fob set is designed to age beautifully and stand the test of time."
  },
  "back-to-school": {
    "title": "Ergonomic Student Backpack with USB Charging Port",
    "main_image": "/template-samples/back-to-school.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Built-in USB charging port for on-the-go power",
      "Ergonomic padded shoulder straps",
      "Spacious main compartment for books and laptop",
      "Water-resistant exterior material"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Polyester",
      "Features: USB Port, Laptop Sleeve",
      "Color: Blue and Yellow"
    ],
    "product_description": "Carry your gear comfortably and stay powered up all day. Featuring a built-in USB charging port, padded straps, and plenty of space, this bright and durable backpack is essential for the active student."
  }
}
$template_samples$
*/
