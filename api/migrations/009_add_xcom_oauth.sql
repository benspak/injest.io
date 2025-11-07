-- Add X.com OAuth token storage to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS xcom_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xcom_refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xcom_token_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xcom_user_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS xcom_username VARCHAR(255);

-- Create index for X.com user ID lookups
CREATE INDEX IF NOT EXISTS idx_users_xcom_user_id ON users(xcom_user_id) WHERE xcom_user_id IS NOT NULL;
