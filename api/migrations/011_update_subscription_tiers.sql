-- Add subscription tier column and seed existing premium users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free';

-- Ensure legacy premium users migrate to Plus tier
UPDATE users
SET subscription_tier = 'plus'
WHERE is_premium = TRUE
  AND (subscription_tier IS NULL OR subscription_tier = 'free');

-- Index for quick lookups by tier
CREATE INDEX IF NOT EXISTS idx_users_subscription_tier
  ON users(subscription_tier);
