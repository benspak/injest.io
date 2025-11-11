-- Ensure contacts can be uniquely identified by either email or phone per owner
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS normalized_phone TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS idx_contacts_owner_normalized_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_email_phone
    ON contacts (owner_id, normalized_email, normalized_phone);
