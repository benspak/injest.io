export interface User {
    id: string;
    email: string;
    verified: boolean;
    created_at: Date;
    updated_at: Date;
}
export declare class UserModel {
    static findByEmail(email: string): Promise<User | null>;
    static findById(id: string): Promise<User | null>;
    static create(email: string): Promise<User>;
    static verifyEmail(id: string): Promise<User>;
    static update(id: string, updates: Partial<User>): Promise<User>;
}
//# sourceMappingURL=User.d.ts.map