-- Add social profile URL columns to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS x_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN contacts.linkedin_url IS 'LinkedIn profile URL';
COMMENT ON COLUMN contacts.x_url IS 'X.com (formerly Twitter) profile URL';
COMMENT ON COLUMN contacts.github_url IS 'GitHub profile URL';
