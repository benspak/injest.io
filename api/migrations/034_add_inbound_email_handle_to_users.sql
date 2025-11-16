-- Add inbound_email_handle column to users for per-user inbound email routing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS inbound_email_handle TEXT;

-- Create a unique index on lower(inbound_email_handle) to enforce case-insensitive uniqueness,
-- while allowing NULL values (only one non-null per user).
CREATE UNIQUE INDEX IF NOT EXISTS users_inbound_email_handle_lower_idx
  ON users (LOWER(inbound_email_handle))
  WHERE inbound_email_handle IS NOT NULL;

-- Backfill inbound_email_handle for existing users:
-- 1) If public_username is set, use its lowercased value.
-- 2) Otherwise, use the lowercased local-part of the email before '@'.
--    If multiple users would collide on the same handle, the unique index
--    will reject duplicates and those users will simply keep NULL.
UPDATE users
SET inbound_email_handle = LOWER(public_username)
WHERE public_username IS NOT NULL
  AND inbound_email_handle IS NULL;

UPDATE users
SET inbound_email_handle = LOWER(SPLIT_PART(email, '@', 1))
WHERE public_username IS NULL
  AND inbound_email_handle IS NULL;
