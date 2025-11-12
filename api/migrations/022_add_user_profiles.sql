-- Add user profile fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS public_username VARCHAR(255),
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS city VARCHAR(255),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS x_profile_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_url TEXT,
ADD COLUMN IF NOT EXISTS github_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS profile_private BOOLEAN DEFAULT TRUE;

-- Create unique index on public_username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_username_lower
ON users (LOWER(public_username))
WHERE public_username IS NOT NULL;

-- Add index on profile_private for filtering
CREATE INDEX IF NOT EXISTS idx_users_profile_private
ON users (profile_private);

-- Set existing NULL profile_private values to TRUE (private by default)
UPDATE users
SET profile_private = TRUE
WHERE profile_private IS NULL;
