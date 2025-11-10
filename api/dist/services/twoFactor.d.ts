export interface TwoFactorSecret {
    secret: string;
    otpauthUrl: string;
}
export declare function generateTwoFactorSecret(email: string): TwoFactorSecret;
export declare function verifyTwoFactorToken(secret: string, token: string): boolean;
export declare function generateRecoveryCodes(count?: number): string[];
export declare function generateRecoveryCode(): string;
export declare function normalizeRecoveryCode(code: string): string;
export declare function hashRecoveryCode(code: string): string;
export declare function verifyRecoveryCode(hashedCodes: string[] | null | undefined, code: string): {
    valid: boolean;
    remaining: string[] | null;
};
//# sourceMappingURL=twoFactor.d.ts.map