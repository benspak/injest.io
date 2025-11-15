-- Add sharing fields to collections table
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS posted_to_profile BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_publicly_shareable BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS share_token UUID;

-- Create unique index on share_token (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_share_token
ON collections (share_token)
WHERE share_token IS NOT NULL;

-- Create index for efficient profile queries
CREATE INDEX IF NOT EXISTS idx_collections_owner_posted_to_profile
ON collections (owner_id, posted_to_profile)
WHERE posted_to_profile = true;
