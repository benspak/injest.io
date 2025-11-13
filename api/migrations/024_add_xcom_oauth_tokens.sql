-- Create xcom_oauth_tokens table for storing X.com OAuth tokens
CREATE TABLE IF NOT EXISTS xcom_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  x_user_id TEXT,
  x_username TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_xcom_oauth_tokens_user_id ON xcom_oauth_tokens(user_id);

-- Create index for X.com user ID lookups
CREATE INDEX IF NOT EXISTS idx_xcom_oauth_tokens_x_user_id ON xcom_oauth_tokens(x_user_id) WHERE x_user_id IS NOT NULL;

-- Add comments to document the table and columns
COMMENT ON TABLE xcom_oauth_tokens IS 'Stores X.com OAuth 2.0 tokens for user authentication';
COMMENT ON COLUMN xcom_oauth_tokens.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN xcom_oauth_tokens.access_token IS 'X.com OAuth 2.0 access token (should be encrypted)';
COMMENT ON COLUMN xcom_oauth_tokens.refresh_token IS 'X.com OAuth 2.0 refresh token (should be encrypted)';
COMMENT ON COLUMN xcom_oauth_tokens.expires_at IS 'Access token expiration timestamp';
COMMENT ON COLUMN xcom_oauth_tokens.x_user_id IS 'X.com user ID';
COMMENT ON COLUMN xcom_oauth_tokens.x_username IS 'X.com username';
