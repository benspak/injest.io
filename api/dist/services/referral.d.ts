export declare class ReferralService {
    /**
     * Validate referral code format
     */
    static validateReferralCode(code: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * Check if referral code is available (unique)
     */
    static isCodeAvailable(code: string, excludeUserId?: string): Promise<boolean>;
    /**
     * Create or update user's referral code
     */
    static setReferralCode(userId: string, code: string): Promise<void>;
    /**
     * Create referral relationship when a user signs up with a referral code
     */
    static createReferral(referrerCode: string, referredUserId: string): Promise<void>;
}
//# sourceMappingURL=referral.d.ts.map