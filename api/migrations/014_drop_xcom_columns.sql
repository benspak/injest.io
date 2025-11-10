-- Remove unused X.com columns from users table
ALTER TABLE users
  DROP COLUMN IF EXISTS xcom_access_token,
  DROP COLUMN IF EXISTS xcom_refresh_token,
  DROP COLUMN IF EXISTS xcom_token_expires_at,
  DROP COLUMN IF EXISTS xcom_user_id,
  DROP COLUMN IF EXISTS xcom_username;

DROP INDEX IF EXISTS idx_users_xcom_user_id;
