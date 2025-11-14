-- Create login_sessions table for tracking user logins
CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_at ON login_sessions(login_at DESC);

-- Add comments to document the table and columns
COMMENT ON TABLE login_sessions IS 'Tracks user login sessions for history and streak calculation';
COMMENT ON COLUMN login_sessions.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN login_sessions.login_at IS 'Timestamp when the login occurred';
COMMENT ON COLUMN login_sessions.ip_address IS 'IP address of the login (optional, for future use)';
COMMENT ON COLUMN login_sessions.user_agent IS 'User agent string (optional, for future use)';
