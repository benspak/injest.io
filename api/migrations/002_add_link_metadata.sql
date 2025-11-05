-- Add link_metadata column to items table for storing link preview metadata
ALTER TABLE items ADD COLUMN IF NOT EXISTS link_metadata JSONB;

-- Create index on link_metadata for performance (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_items_link_metadata ON items USING GIN (link_metadata) WHERE link_metadata IS NOT NULL;


