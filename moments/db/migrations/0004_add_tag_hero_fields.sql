-- Add hero fields to tags for customizable hero section per tag
ALTER TABLE tags ADD COLUMN hero_title TEXT;
ALTER TABLE tags ADD COLUMN hero_subtitle TEXT;
ALTER TABLE tags ADD COLUMN hero_item_id TEXT;
