-- Add inbound_email_handle column to users for per-user inbound email routing
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS inbound_email_handle TEXT;

-- Create a unique index on lower(inbound_email_handle) to enforce case-insensitive uniqueness,
-- while allowing NULL values (only one non-null per user).
CREATE UNIQUE INDEX IF NOT EXISTS users_inbound_email_handle_lower_idx
  ON users (LOWER(inbound_email_handle))
  WHERE inbound_email_handle IS NOT NULL;
