import { UserModel } from '../models/User.js';
import { ReferralModel } from '../models/Referral.js';
export class ReferralService {
    /**
     * Validate referral code format
     */
    static validateReferralCode(code) {
        if (!code || code.trim().length === 0) {
            return { valid: false, error: 'Referral code is required' };
        }
        const trimmed = code.trim();
        if (trimmed.length < 3) {
            return { valid: false, error: 'Referral code must be at least 3 characters' };
        }
        if (trimmed.length > 20) {
            return { valid: false, error: 'Referral code must be at most 20 characters' };
        }
        // Alphanumeric and hyphens only
        if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
            return { valid: false, error: 'Referral code can only contain letters, numbers, and hyphens' };
        }
        return { valid: true };
    }
    /**
     * Check if referral code is available (unique)
     */
    static async isCodeAvailable(code, excludeUserId) {
        const user = await UserModel.findByReferralCode(code);
        if (!user) {
            return true;
        }
        // If checking for a specific user, allow them to use their own code
        if (excludeUserId && user.id === excludeUserId) {
            return true;
        }
        return false;
    }
    /**
     * Create or update user's referral code
     */
    static async setReferralCode(userId, code) {
        const validation = this.validateReferralCode(code);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
        const trimmed = code.trim();
        const isAvailable = await this.isCodeAvailable(trimmed, userId);
        if (!isAvailable) {
            throw new Error('Referral code is already taken');
        }
        // Check if user already has a referral code
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        // Allow setting code if user doesn't have one, or allow one change
        // For simplicity, we'll allow updates (you can restrict this if needed)
        await UserModel.update(userId, {
            referral_code: trimmed.toLowerCase(),
        });
    }
    /**
     * Create referral relationship when a user signs up with a referral code
     */
    static async createReferral(referrerCode, referredUserId) {
        const referrer = await UserModel.findByReferralCode(referrerCode);
        if (!referrer) {
            throw new Error('Invalid referral code');
        }
        // Prevent self-referral
        if (referrer.id === referredUserId) {
            throw new Error('Cannot refer yourself');
        }
        // Check if user is already referred
        const existingReferral = await ReferralModel.findByReferredUserId(referredUserId);
        if (existingReferral) {
            // Already referred, don't create duplicate
            return;
        }
        await ReferralModel.create(referrer.id, referredUserId, referrerCode.toLowerCase());
    }
}
//# sourceMappingURL=referral.js.map