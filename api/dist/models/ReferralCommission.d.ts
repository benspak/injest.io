export type CommissionStatus = 'pending' | 'paid' | 'failed';
export interface ReferralCommission {
    id: string;
    referral_id: string;
    payment_intent_id: string;
    amount_cents: number;
    status: CommissionStatus;
    stripe_transfer_id: string | null;
    created_at: Date;
    paid_at: Date | null;
}
export declare class ReferralCommissionModel {
    static create(referralId: string, paymentIntentId: string, amountCents: number, status?: CommissionStatus): Promise<ReferralCommission>;
    static findByReferralId(referralId: string): Promise<ReferralCommission[]>;
    static findById(id: string): Promise<ReferralCommission | null>;
    static findByPaymentIntentId(paymentIntentId: string): Promise<ReferralCommission | null>;
    static updateStatus(id: string, status: CommissionStatus, stripeTransferId?: string | null, paidAt?: Date | null): Promise<ReferralCommission>;
    static getTotalEarningsByReferrerId(referrerId: string): Promise<number>;
    static getPendingEarningsByReferrerId(referrerId: string): Promise<number>;
    static getCommissionsByReferrerId(referrerId: string, limit?: number, offset?: number): Promise<ReferralCommission[]>;
}
//# sourceMappingURL=ReferralCommission.d.ts.map