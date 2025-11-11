-- Contacts table to store extracted contact details from OCR and other sources
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT,
    normalized_name TEXT NOT NULL DEFAULT '',
    email TEXT,
    normalized_email TEXT NOT NULL DEFAULT '',
    phone TEXT,
    normalized_phone TEXT NOT NULL DEFAULT '',
    source_item_id UUID REFERENCES items(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_email_phone_name
    ON contacts (owner_id, normalized_email, normalized_phone, normalized_name);

CREATE INDEX IF NOT EXISTS idx_contacts_owner_id
    ON contacts (owner_id);

CREATE INDEX IF NOT EXISTS idx_contacts_source_item_id
    ON contacts (source_item_id);

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
