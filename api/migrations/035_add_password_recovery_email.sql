-- Add password_hash and recovery_email columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS recovery_email VARCHAR(255);

-- Create index on recovery_email for lookups
CREATE INDEX IF NOT EXISTS idx_users_recovery_email ON users(recovery_email)
  WHERE recovery_email IS NOT NULL;
