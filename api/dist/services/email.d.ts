export declare class EmailService {
    private resend;
    constructor();
    sendMagicLink(email: string, magicLink: string): Promise<void>;
    sendApprovalEmail(email: string): Promise<void>;
}
export declare const emailService: EmailService;
//# sourceMappingURL=email.d.ts.map