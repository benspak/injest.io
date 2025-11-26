-- Migration: Add encryption support documentation
-- This migration adds comments to document which fields are encrypted
-- No schema changes are needed as encryption is handled at the application level

-- OAuth Tokens
COMMENT ON COLUMN xcom_oauth_tokens.access_token IS 'X.com OAuth access token (encrypted at rest)';
COMMENT ON COLUMN xcom_oauth_tokens.refresh_token IS 'X.com OAuth refresh token (encrypted at rest)';

COMMENT ON COLUMN slack_oauth_tokens.access_token IS 'Slack OAuth access token (encrypted at rest)';
COMMENT ON COLUMN slack_oauth_tokens.authed_user_token IS 'Slack OAuth user token (encrypted at rest)';

-- Users
COMMENT ON COLUMN users.email IS 'User email address (encrypted at rest, deterministic for searchability)';
COMMENT ON COLUMN users.recovery_email IS 'Recovery email address (encrypted at rest, deterministic for searchability)';
COMMENT ON COLUMN users.first_name IS 'User first name (encrypted at rest)';
COMMENT ON COLUMN users.last_name IS 'User last name (encrypted at rest)';
COMMENT ON COLUMN users.zip_code IS 'User zip code (encrypted at rest)';
COMMENT ON COLUMN users.city IS 'User city (encrypted at rest)';
COMMENT ON COLUMN users.two_factor_secret IS 'Two-factor authentication secret (encrypted at rest)';

-- Contacts
COMMENT ON COLUMN contacts.first_name IS 'Contact first name (encrypted at rest)';
COMMENT ON COLUMN contacts.last_name IS 'Contact last name (encrypted at rest)';
COMMENT ON COLUMN contacts.email IS 'Contact email address (encrypted at rest, deterministic for searchability)';
COMMENT ON COLUMN contacts.phone IS 'Contact phone number (encrypted at rest, deterministic for searchability)';

-- Items
COMMENT ON COLUMN items.raw IS 'Raw item content, typically JSON for emails (encrypted at rest)';
COMMENT ON COLUMN items.title IS 'Item title (encrypted at rest, deterministic for searchability)';
COMMENT ON COLUMN items.description IS 'Item description/content (encrypted at rest)';
COMMENT ON COLUMN items.notes IS 'User notes on item (encrypted at rest)';
COMMENT ON COLUMN items.clean IS 'Cleaned/summarized content (encrypted at rest)';

-- Search Documents
COMMENT ON COLUMN search_documents.title IS 'Search document title (encrypted at rest, deterministic for searchability)';
COMMENT ON COLUMN search_documents.content IS 'Search document content (encrypted at rest)';
COMMENT ON COLUMN search_documents.summary IS 'Search document summary (encrypted at rest)';
