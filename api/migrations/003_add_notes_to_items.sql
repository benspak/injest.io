-- Add notes column to items table for storing user notes on links
ALTER TABLE items ADD COLUMN IF NOT EXISTS notes TEXT;
