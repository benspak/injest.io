CREATE TABLE IF NOT EXISTS user_file_hashes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    checksum TEXT NOT NULL,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    attachment_filename TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_file_hashes_owner_checksum
    ON user_file_hashes(owner_id, checksum);

CREATE INDEX IF NOT EXISTS idx_user_file_hashes_item_id
    ON user_file_hashes(item_id);
