-- apps/api/migrations/122_template_sample_products.sql
-- Replaces the sample product every catalog template previews with.
--
-- Migration 073 seeded each template's sample_data with a hotlinked Unsplash
-- photo and branded-sounding copy ("…For 2010-2015 Honda Civic"). An Unsplash
-- licence covers the photograph, not the product or brand pictured in it, so
-- neither may be shown to sellers. Every sample below is:
--   - CC0 / public domain (verified via the Wikimedia Commons API) or Pexels
--     (see apps/web/public/template-samples/CREDITS.md), served same-origin
--     from /template-samples/ so the preview makes no external request;
--   - `Brand: Unbranded`, with no real model number, MPN or UPC;
--   - written to describe the item actually in the photo.
--
-- The landing page's template gallery (scripts/build-template-previews.mjs)
-- reads this same JSON literal, so the landing and the in-app picker always
-- preview the same product. predefined-templates.guard.spec.ts reads it too.
--
-- Keyed by slug (still `ds-*`; migration 115 only renamed `name`). Only
-- sample_data changes: id and created_at are untouched, and 073 is not edited.
-- To change a sample, copy this file to a new migration number — an applied
-- migration never re-runs.

UPDATE predefined_templates AS t
SET sample_data = s.data,
    updated_at  = NOW()
FROM jsonb_each($template_samples$
{
  "ds-general-store": {
    "title": "Portable Shower Speaker, Waterproof, Suction Cup Mount, Built-In Mic",
    "main_image": "/template-samples/bluetooth-speaker.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Waterproof shell, safe in the shower",
      "Strong suction cup sticks to tile and glass",
      "Built-in microphone for hands-free calls",
      "Up to 6 hours of playtime per charge"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Connectivity: Bluetooth 5.0",
      "Battery Life: 6 Hours",
      "Mounting: Suction Cup",
      "Color: Pink"
    ],
    "product_description": "Take your music into the shower. A strong suction cup, a splash-proof shell and simple button controls make this compact speaker easy to use in the bathroom, the kitchen or the garden."
  },
  "ds-minimalist": {
    "title": "Handheld Milk Frother, Battery Powered Whisk for Coffee, Latte & Matcha",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Creamy froth in 15 to 20 seconds",
      "Stainless steel whisk head",
      "One-button operation"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Stainless Steel, ABS",
      "Power Source: 2 x AA Battery",
      "Color: Black"
    ],
    "product_description": "Froth milk in seconds for lattes, cappuccinos and matcha. A stainless steel whisk and a single button make it simple to use and easy to rinse clean."
  },
  "ds-tech-gadgets": {
    "title": "Wireless Earbuds, Active Noise Cancelling, 40H Battery, Bluetooth 5.3",
    "main_image": "/template-samples/wireless-earbuds.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Active noise cancelling for travel and focus",
      "40 hours total with the charging case",
      "Low-latency mode for gaming",
      "IPX5 sweat and water resistant"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Connectivity: Bluetooth 5.3",
      "Battery Life: 40 Hours",
      "Water Resistance: IPX5",
      "Color: Black"
    ],
    "product_description": "Hybrid active noise cancelling, a 40-hour charging case and a low-latency game mode, in compact earbuds for travel, work and workouts."
  },
  "ds-home-decor": {
    "title": "Down-Alternative Bed Pillow, Soft Microfiber Fill, Standard Size, Set of 2",
    "main_image": "/template-samples/bed-pillow.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Soft, plump down-alternative fill",
      "Hypoallergenic microfiber",
      "Breathable cotton-blend cover",
      "Machine washable"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Size: Standard",
      "Fill Material: Microfiber",
      "Firmness: Medium",
      "Color: White"
    ],
    "product_description": "Plump, cloud-soft pillows with a hypoallergenic microfiber fill that keeps its loft night after night. A breathable cotton-blend cover keeps them fresh."
  },
  "ds-auto-parts": {
    "title": "Engine Air Filter, Pleated Paper Panel Filter, Direct Replacement",
    "main_image": "/template-samples/air-filter.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Pleated filter media for high dirt capacity",
      "Flexible polyurethane edge seal",
      "Fits in minutes, no tools needed",
      "Replace every 12,000 miles"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Filter Type: Panel",
      "Media: Pleated Paper",
      "Seal Material: Polyurethane",
      "Color: Orange"
    ],
    "product_description": "A pleated paper panel filter that traps dust and debris before it reaches the engine. A flexible polyurethane seal gives a tight fit in the air box."
  },
  "ds-apparel-fashion": {
    "title": "Women's Chunky Rib-Knit Cardigan, V-Neck Button Front, Relaxed Fit",
    "main_image": "/template-samples/knit-cardigans.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Chunky rib knit, soft and warm",
      "V-neck with button front",
      "Ribbed cuffs and hem",
      "Relaxed, easy-layering fit"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Cotton Blend",
      "Style: Cardigan",
      "Sleeve Length: Long Sleeve",
      "Color: Grey, Cream, Camel"
    ],
    "product_description": "A soft, chunky rib-knit cardigan with a V-neck, a two-button front and ribbed cuffs. Relaxed enough to layer, available in grey, cream and camel."
  },
  "ds-beauty-health": {
    "title": "Natural Handmade Soap Bars, Set of 5, Plant-Based, Assorted Scents",
    "main_image": "/template-samples/natural-soap-bars.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Set of 5 assorted bars",
      "Plant-based oils and butters",
      "No synthetic dyes or parabens",
      "Gentle on face and body"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Weight: 5 x 3.5 oz",
      "Skin Type: All",
      "Form: Bar",
      "Scent: Assorted"
    ],
    "product_description": "Five hand-cut, plant-based soap bars in creamy neutral tones, from a gentle unscented bar to an oat-flecked exfoliating one. Rich lather, no synthetic dyes."
  },
  "ds-pet-supplies": {
    "title": "Stainless Steel Dog Bowl with Melamine Stand, Non-Slip, 3 Cups",
    "main_image": "/template-samples/steel-dog-bowl.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Removable stainless steel bowl",
      "Sturdy melamine outer stand",
      "Non-slip rubber base",
      "Dishwasher safe"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Pet Type: Dog, Cat",
      "Material: Stainless Steel, Melamine",
      "Capacity: 3 Cups",
      "Color: White"
    ],
    "product_description": "A removable stainless steel bowl set in a sturdy melamine stand with a non-slip rubber base. Rust-resistant, dishwasher-safe and easy to keep clean."
  },
  "ds-fitness-sports": {
    "title": "Non-Slip Yoga Mat, 6mm Thick, Lightweight Exercise Mat with Carry Strap",
    "main_image": "/template-samples/yoga-mat.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "6mm cushioning protects knees and wrists",
      "Textured non-slip surface on both sides",
      "Lightweight and easy to roll up",
      "Carry strap included"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: TPE",
      "Thickness: 6 mm",
      "Dimensions: 72 x 24 in",
      "Color: Teal"
    ],
    "product_description": "A cushioned 6mm mat with a textured, non-slip surface for yoga, pilates and floor workouts, light enough to carry to class."
  },
  "ds-outdoor-survival": {
    "title": "LED Flashlight, 9-Bulb Aluminum Torch with Wrist Strap, Water Resistant",
    "main_image": "/template-samples/led-flashlight.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Nine bright white LEDs",
      "Durable aluminum body with textured grip",
      "Water-resistant for rain and camp use",
      "Wrist strap included"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Light Source: LED",
      "Body Material: Aluminum",
      "Power Source: 3 x AAA Battery",
      "Color: Black"
    ],
    "product_description": "A compact aluminum flashlight with nine bright LEDs, a textured grip and a wrist strap. Tough enough for the trail, small enough for a glove box."
  },
  "ds-toys-kids": {
    "title": "Wooden Building Blocks, 60 Pieces, Natural Beech Wood Stacking Set",
    "main_image": "/template-samples/wooden-blocks.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "60 smooth, sanded beech wood pieces",
      "Unfinished natural wood, no paint",
      "Cubes, bars, cylinders and triangles",
      "Builds balance and fine motor skills"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Beech Wood",
      "Age Range: 3 Years and Up",
      "Piece Count: 60",
      "Color: Natural"
    ],
    "product_description": "A classic set of smooth, sanded natural beech blocks — cubes, bars, cylinders and triangles. Build towers, bridges and castles, then knock them down and start again."
  },
  "ds-kitchen-dining": {
    "title": "Digital Kitchen Scale, 0.1 oz Precision, Tare Function, Stainless Steel",
    "main_image": "/template-samples/kitchen-scale.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Accurate to 0.1 oz / 1 g, up to 11 lb",
      "One-touch tare and unit conversion",
      "Bright LED display",
      "Easy-to-clean stainless steel platform"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Maximum Weight: 11 lb",
      "Display: LED",
      "Material: Stainless Steel",
      "Color: Silver"
    ],
    "product_description": "Weigh ingredients to the gram for baking, meal prep and coffee. A bright LED display and one-touch tare keep measuring fast."
  }
}
$template_samples$::jsonb) AS s(slug, data)
WHERE t.slug = s.slug;
