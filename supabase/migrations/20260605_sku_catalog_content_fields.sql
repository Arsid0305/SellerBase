-- WB Content API fields for sku_catalog
ALTER TABLE sku_catalog ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE sku_catalog ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2);
ALTER TABLE sku_catalog ADD COLUMN IF NOT EXISTS reviews_count INT;
ALTER TABLE sku_catalog ADD COLUMN IF NOT EXISTS last_content_sync_at TIMESTAMPTZ;
