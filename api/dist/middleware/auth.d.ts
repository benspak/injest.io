import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
    };
    body: any;
    query: any;
    params: any;
    files?: Express.Multer.File[] | {
        [fieldname: string]: Express.Multer.File[];
    } | Express.Multer.File[];
}
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map