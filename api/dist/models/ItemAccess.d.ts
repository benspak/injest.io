export interface ItemAccess {
    id: string;
    item_id: string;
    user_id: string | null;
    email: string;
    normalized_email: string;
    granted_by: string | null;
    created_at: Date;
    updated_at: Date;
}
interface GrantAccessOptions {
    grantedByUserId?: string;
}
export declare class ItemAccessModel {
    static grantAccess(itemId: string, email: string, options?: GrantAccessOptions): Promise<void>;
    static userHasAccess(itemId: string, userId: string, email?: string): Promise<boolean>;
    static linkUserToEmail(userId: string, email: string): Promise<void>;
}
export declare const itemAccessEmailNormalizer: (value: string) => string;
export {};
//# sourceMappingURL=ItemAccess.d.ts.map