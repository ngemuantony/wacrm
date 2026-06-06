-- Migration: Add Till Number and Multi-image support

-- 1. Accounts: Add Till Number
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS daraja_till_number TEXT;

-- 2. Products: Convert image_url to image_urls array
-- Since image_url is TEXT, we create a new array column, migrate data, and drop the old one.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Migrate existing images
UPDATE products
  SET image_urls = ARRAY[image_url]
  WHERE image_url IS NOT NULL AND image_url != '';

-- Drop old column
ALTER TABLE products
  DROP COLUMN IF EXISTS image_url;
