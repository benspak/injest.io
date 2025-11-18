-- Add referral_code to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255);

-- Create unique index on referral_code (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_lower
ON users (LOWER(referral_code))
WHERE referral_code IS NOT NULL;

-- Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on referrals table
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON referrals(referral_code);

-- Create referral_commissions table
CREATE TABLE IF NOT EXISTS referral_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    payment_intent_id VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    stripe_transfer_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes on referral_commissions table
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referral_id ON referral_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_payment_intent_id ON referral_commissions(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(status);

-- Add constraint to ensure status is valid
ALTER TABLE referral_commissions
ADD CONSTRAINT check_status CHECK (status IN ('pending', 'paid', 'failed'));
