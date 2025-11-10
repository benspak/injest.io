import express from 'express';
import { AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
declare const router: import("express-serve-static-core").Router;
export declare const upload: multer.Multer;
export declare function handleCreateItem(req: AuthRequest, res: express.Response): Promise<express.Response<any, Record<string, any>> | undefined>;
export default router;
//# sourceMappingURL=items.d.ts.map