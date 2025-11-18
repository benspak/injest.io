export interface Referral {
    id: string;
    referrer_id: string;
    referred_user_id: string;
    referral_code: string;
    created_at: Date;
}
export declare class ReferralModel {
    static create(referrerId: string, referredUserId: string, referralCode: string): Promise<Referral>;
    static findByReferredUserId(referredUserId: string): Promise<Referral | null>;
    static findByReferrerId(referrerId: string): Promise<Referral[]>;
    static findById(id: string): Promise<Referral | null>;
    static countByReferrerId(referrerId: string): Promise<number>;
}
//# sourceMappingURL=Referral.d.ts.map