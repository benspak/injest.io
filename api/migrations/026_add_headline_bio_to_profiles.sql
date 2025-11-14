-- Add headline and bio fields to user profiles
ALTER TABLE users
ADD COLUMN IF NOT EXISTS headline VARCHAR(100),
ADD COLUMN IF NOT EXISTS bio VARCHAR(250);
