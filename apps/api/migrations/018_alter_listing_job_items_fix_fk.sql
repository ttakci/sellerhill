-- Fix FK constraint to use ON DELETE SET NULL instead of CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'listing_job_items_product_id_fkey'
    AND table_name = 'listing_job_items'
  ) THEN
    ALTER TABLE listing_job_items DROP CONSTRAINT listing_job_items_product_id_fkey;
    ALTER TABLE listing_job_items ADD CONSTRAINT listing_job_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;
