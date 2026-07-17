-- Listing content policy (strip brand, AI title/description scaffold)
ALTER TABLE listing_settings_groups
  ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{
    "stripBrandFromTitle": false,
    "aiTitleEnabled": false,
    "aiDescriptionEnabled": false
  }'::jsonb;
