import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from './jwt.js';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.cookies?.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
