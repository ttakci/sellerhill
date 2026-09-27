-- apps/api/migrations/122_template_sample_products.sql
-- Replaces the sample product every catalog template previews with.
--
-- Migration 073 seeded each template's sample_data with a hotlinked Unsplash
-- photo and branded-sounding copy ("…For 2010-2015 Honda Civic"). An Unsplash
-- licence covers the photograph, not the product or brand pictured in it, so
-- neither may be shown to sellers. Every sample below is:
--   - photographed CC0 / public domain (verified against the Wikimedia Commons
--     API, see apps/web/public/template-samples/CREDITS.md), served same-origin
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
    "title": "Women's Fine-Knit Button-Front Cardigan, Stand Collar, Long Sleeve, Burgundy",
    "main_image": "/template-samples/knit-cardigan.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Fine-gauge knit with a soft hand",
      "Full-length button placket",
      "Stand collar and long sleeves",
      "Fitted silhouette"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Wool Blend",
      "Style: Cardigan",
      "Sleeve Length: Long Sleeve",
      "Color: Burgundy"
    ],
    "product_description": "A fitted, fine-gauge knit cardigan with a stand collar and a long row of small buttons. It dresses up with a skirt and down with jeans."
  },
  "ds-beauty-health": {
    "title": "Handmade Glycerin Soap Bar, Heart Shaped, Layered Pink, Purple & Blue, 4 oz",
    "main_image": "/template-samples/heart-soap.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Gentle glycerin base for everyday use",
      "Three hand-poured color layers",
      "Heart shape, a ready-made gift",
      "Individually shrink-wrapped"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Weight: 4 oz",
      "Skin Type: All",
      "Form: Bar",
      "Color: Pink, Purple, Blue"
    ],
    "product_description": "A gentle glycerin soap poured by hand in three colored layers and shaped like a heart. Mild enough for daily use, pretty enough to give as a gift."
  },
  "ds-pet-supplies": {
    "title": "Slow Feeder Dog Bowl, Anti-Gulping Maze Design, Non-Slip Base",
    "main_image": "/template-samples/slow-feeder-bowl.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Slows eating up to 10 times",
      "Raised maze pattern",
      "Non-slip base",
      "Dishwasher safe"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Pet Type: Dog",
      "Material: BPA-Free Plastic",
      "Capacity: 2 Cups",
      "Color: Blue"
    ],
    "product_description": "Raised studs and ridges turn every meal into a gentle puzzle, so fast eaters slow down and swallow less air. The non-slip base keeps the bowl in place."
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
    "title": "Wooden Building Blocks, Colorful Stacking Set for Kids, Natural Wood",
    "main_image": "/template-samples/wooden-blocks.jpg",
    "has_features": "1",
    "has_details": "1",
    "feature_bullets": [
      "Smooth, sanded hardwood blocks",
      "Bright, child-safe water-based paint",
      "Arches, cubes, cylinders and bars",
      "Builds balance and fine motor skills"
    ],
    "product_details": [
      "Brand: Unbranded",
      "Material: Wood",
      "Age Range: 3 Years and Up",
      "Piece Count: 50",
      "Color: Multicolor"
    ],
    "product_description": "A classic set of smooth, sanded wooden blocks in bright colors and natural wood. Build towers, bridges and castles, then knock them down and start again."
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
