-- Unified Item Structure Migration
-- Note: For fresh databases, these columns are already in 001_initial_schema.sql
-- This migration is for existing databases that need to add these columns
-- Add new columns for unified item structure (if they don't exist)
ALTER TABLE items ADD COLUMN IF NOT EXISTS title VARCHAR(500);
ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS attachments JSONB;

-- Migrate existing data from raw field
-- For links: extract raw URL to url column
UPDATE items
SET url = raw
WHERE type = 'link' AND url IS NULL;

-- For notes: parse raw JSON and extract title/description
UPDATE items
SET
  title = COALESCE(
    (raw::json->>'title'),
    (raw::json->>'subject'),
    ''
  ),
  description = COALESCE(
    (raw::json->>'description'),
    (raw::json->>'body'),
    (raw::json->>'text'),
    raw
  )
WHERE type = 'note'
  AND (title IS NULL OR description IS NULL)
  AND raw IS NOT NULL
  AND raw ~ '^\s*\{'; -- Only process if raw looks like JSON

-- For files: parse raw JSON and extract title/description/attachments
UPDATE items
SET
  title = COALESCE(
    (raw::json->>'title'),
    ''
  ),
  description = COALESCE(
    (raw::json->>'description'),
    ''
  ),
  attachments = COALESCE(
    (raw::json->'files')::jsonb,
    '[]'::jsonb
  )
WHERE type = 'file'
  AND (title IS NULL OR description IS NULL OR attachments IS NULL)
  AND raw IS NOT NULL
  AND raw ~ '^\s*\{'; -- Only process if raw looks like JSON

-- For emails: extract subject/title and body/description
UPDATE items
SET
  title = COALESCE(
    (raw::json->>'subject'),
    ''
  ),
  description = COALESCE(
    (raw::json->>'body'),
    (raw::json->>'text'),
    ''
  ),
  attachments = COALESCE(
    (raw::json->'attachments')::jsonb,
    '[]'::jsonb
  )
WHERE type = 'email'
  AND (title IS NULL OR description IS NULL)
  AND raw IS NOT NULL
  AND raw ~ '^\s*\{'; -- Only process if raw looks like JSON

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_url ON items(url) WHERE url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_attachments ON items USING GIN (attachments) WHERE attachments IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_title ON items(title) WHERE title IS NOT NULL;

-- Make type column nullable for backward compatibility (new items won't need type)
ALTER TABLE items ALTER COLUMN type DROP NOT NULL;
