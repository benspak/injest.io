import type { Request, Response, NextFunction } from 'express';
export interface ApiKeyRequest extends Request {
    apiUser?: {
        id: string;
        email: string;
    };
}
export declare function apiKeyAuthMiddleware(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=apiKeyAuth.d.ts.map