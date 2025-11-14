-- Limit headline to 100 characters and bio to 250 characters
-- First, truncate any existing data that exceeds the limits
UPDATE users
SET headline = LEFT(headline, 100)
WHERE headline IS NOT NULL AND LENGTH(headline) > 100;

UPDATE users
SET bio = LEFT(bio, 250)
WHERE bio IS NOT NULL AND LENGTH(bio) > 250;

-- Then alter the column types
ALTER TABLE users
ALTER COLUMN headline TYPE VARCHAR(100);

-- For bio, we'll use VARCHAR(250) instead of TEXT to enforce the limit
ALTER TABLE users
ALTER COLUMN bio TYPE VARCHAR(250);
