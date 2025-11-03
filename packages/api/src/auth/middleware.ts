import { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt.js';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    req.userId = payload.userId;
    req.userEmail = payload.email;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
