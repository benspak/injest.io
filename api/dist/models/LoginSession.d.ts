export interface LoginSession {
    id: string;
    user_id: string;
    login_at: Date;
    ip_address?: string | null;
    user_agent?: string | null;
    created_at: Date;
}
export declare class LoginSessionModel {
    static create(userId: string, loginAt?: Date): Promise<LoginSession>;
    static findByUserId(userId: string, limit?: number, offset?: number): Promise<LoginSession[]>;
    static countByUserId(userId: string): Promise<number>;
    static getLoginStreak(userId: string): Promise<{
        currentStreak: number;
        weekDays: number[];
    }>;
}
//# sourceMappingURL=LoginSession.d.ts.map