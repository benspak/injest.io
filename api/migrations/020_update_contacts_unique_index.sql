-- Ensure contacts can be uniquely identified by either email or phone per owner
-- Note: normalized_phone column already exists in migration 018, but this ensures it's there
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS normalized_phone TEXT NOT NULL DEFAULT '';

-- Drop the original index from migration 018 and any intermediate indexes
DROP INDEX IF EXISTS idx_contacts_owner_email_phone_name;
DROP INDEX IF EXISTS idx_contacts_owner_normalized_email;

-- Create the final unique index on owner, email, and phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_email_phone
    ON contacts (owner_id, normalized_email, normalized_phone);
