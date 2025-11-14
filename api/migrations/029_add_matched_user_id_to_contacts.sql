-- Add matched_user_id column to contacts table for contact enrichment
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS matched_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_contacts_matched_user_id ON contacts(matched_user_id);

-- Add comment documenting the column purpose
COMMENT ON COLUMN contacts.matched_user_id IS 'Reference to matched user profile (only public profiles) for contact enrichment';
