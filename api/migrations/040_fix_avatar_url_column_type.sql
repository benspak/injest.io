-- Fix avatar_url column type to support longer file paths
-- The column was incorrectly created as VARCHAR(20) but should be TEXT
-- to accommodate file paths like "avatars/{userId}-{timestamp}-{uuid}.{ext}"
-- Only alter if the column exists and is not already TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'avatar_url'
        AND data_type = 'character varying'
        AND character_maximum_length = 20
    ) THEN
        ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;
    END IF;
END $$;
