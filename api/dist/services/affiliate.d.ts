export declare class AffiliateService {
    /**
     * Calculate commission amount (20% of discounted payment)
     */
    static calculateCommission(amountCents: number): number;
    /**
     * Process commission for a successful payment
     * Note: Commissions are NOT processed for annual plans (pro_annual, business)
     */
    static processCommission(paymentIntentId: string, userId: string, amountCents: number, subscriptionTier?: string): Promise<void>;
    /**
     * Transfer commission to Stripe Connect account
     */
    static transferCommission(connectAccountId: string, amountCents: number, commissionId: string): Promise<void>;
    /**
     * Retry failed commission transfer
     */
    static retryCommission(commissionId: string): Promise<void>;
}
//# sourceMappingURL=affiliate.d.ts.map