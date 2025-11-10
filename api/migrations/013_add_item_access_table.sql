-- Item access table to track shared access by email and user
CREATE TABLE IF NOT EXISTS item_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    normalized_email VARCHAR(255) NOT NULL,
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_access_item_email
    ON item_access (item_id, normalized_email);

CREATE INDEX IF NOT EXISTS idx_item_access_user_id
    ON item_access (user_id);

CREATE INDEX IF NOT EXISTS idx_item_access_normalized_email
    ON item_access (normalized_email);

DROP TRIGGER IF EXISTS update_item_access_updated_at ON item_access;
CREATE TRIGGER update_item_access_updated_at
    BEFORE UPDATE ON item_access
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
