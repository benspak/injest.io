-- Add soft delete support to items table
-- This allows items to be marked as deleted without actually removing them from the database
-- This prevents deleted items from being re-indexed when syncing from external sources (e.g., Resend emails)

ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient filtering of non-deleted items
CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items(deleted_at) WHERE deleted_at IS NULL;

-- Create index for efficient lookup of deleted items by resend_email_id (for email sync)
CREATE INDEX IF NOT EXISTS idx_items_resend_email_id_deleted ON items((raw::jsonb->>'resend_email_id'), deleted_at)
WHERE type = 'email' AND raw IS NOT NULL;
