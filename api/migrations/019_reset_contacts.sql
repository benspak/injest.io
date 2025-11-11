-- Purge contacts data and enforce unique emails per owner
DELETE FROM contacts;

DROP INDEX IF EXISTS idx_contacts_owner_email_phone_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_normalized_email
    ON contacts (owner_id, normalized_email);
