-- Add inbound_email_handle column to users for per-user inbound email routing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS inbound_email_handle TEXT;

-- Create a unique index on lower(inbound_email_handle) to enforce case-insensitive uniqueness,
-- while allowing NULL values (only one non-null per user).
CREATE UNIQUE INDEX IF NOT EXISTS users_inbound_email_handle_lower_idx
  ON users (LOWER(inbound_email_handle))
  WHERE inbound_email_handle IS NOT NULL;

-- Backfill inbound_email_handle for existing users, but only when the candidate
-- handle is UNIQUE across users (to avoid violating the unique index).
-- 1) If public_username is set and unique (case-insensitive), use its lowercased value.
UPDATE users u
SET inbound_email_handle = LOWER(u.public_username)
WHERE u.public_username IS NOT NULL
  AND u.inbound_email_handle IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users u2
    WHERE u2.id <> u.id
      AND LOWER(u2.public_username) = LOWER(u.public_username)
  );

-- 2) Otherwise, use the lowercased local-part of the email before '@' *only*
--    when that local-part is unique (case-insensitive) among users.
UPDATE users u
SET inbound_email_handle = LOWER(SPLIT_PART(u.email, '@', 1))
WHERE u.public_username IS NULL
  AND u.inbound_email_handle IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users u2
    WHERE u2.id <> u.id
      AND LOWER(SPLIT_PART(u2.email, '@', 1)) = LOWER(SPLIT_PART(u.email, '@', 1))
  );
