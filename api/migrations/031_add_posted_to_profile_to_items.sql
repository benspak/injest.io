-- Add posted_to_profile column to items table
ALTER TABLE items
ADD COLUMN IF NOT EXISTS posted_to_profile BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for efficient profile queries
CREATE INDEX IF NOT EXISTS idx_items_owner_posted_to_profile
    ON items (owner_id, posted_to_profile)
    WHERE deleted_at IS NULL;
