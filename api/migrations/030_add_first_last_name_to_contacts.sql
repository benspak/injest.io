-- Add first_name and last_name columns to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS normalized_first_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS normalized_last_name TEXT NOT NULL DEFAULT '';

-- Migrate existing name data to first_name and last_name
-- Split name on first space, first part goes to first_name, rest goes to last_name
UPDATE contacts
SET
  first_name = CASE
    WHEN name IS NOT NULL AND name != '' THEN
      TRIM(SPLIT_PART(name, ' ', 1))
    ELSE NULL
  END,
  last_name = CASE
    WHEN name IS NOT NULL AND name != '' AND POSITION(' ' IN name) > 0 THEN
      TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1))
    ELSE NULL
  END,
  normalized_first_name = CASE
    WHEN name IS NOT NULL AND name != '' THEN
      LOWER(TRIM(SPLIT_PART(name, ' ', 1)))
    ELSE ''
  END,
  normalized_last_name = CASE
    WHEN name IS NOT NULL AND name != '' AND POSITION(' ' IN name) > 0 THEN
      LOWER(TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1)))
    ELSE ''
  END
WHERE first_name IS NULL;

-- Update unique index to use normalized_first_name and normalized_last_name
DROP INDEX IF EXISTS idx_contacts_owner_email_phone_name;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_owner_email_phone_name
    ON contacts (owner_id, normalized_email, normalized_phone, normalized_first_name, normalized_last_name);

-- Add index for searching by first/last name
CREATE INDEX IF NOT EXISTS idx_contacts_normalized_names
    ON contacts (normalized_first_name, normalized_last_name);
