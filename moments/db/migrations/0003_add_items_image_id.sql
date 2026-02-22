-- Add image_id for Cloudflare Images-backed photos
ALTER TABLE items ADD COLUMN image_id TEXT;

CREATE INDEX idx_items_image_id ON items(image_id) WHERE image_id IS NOT NULL;
