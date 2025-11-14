-- Add company and project fields to user profiles
ALTER TABLE users
ADD COLUMN IF NOT EXISTS company VARCHAR(200),
ADD COLUMN IF NOT EXISTS project_title VARCHAR(200),
ADD COLUMN IF NOT EXISTS project_description VARCHAR(500);
