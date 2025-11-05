import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/auth.js';
import { UserModel } from '../models/User.js';
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await UserModel.findById(decoded.userId);
        if (!user || !user.verified) {
            res.status(401).json({ error: 'User not found or not verified' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
        };
        next();
    }
    catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        res.status(500).json({ error: 'Authentication error' });
    }
};
//# sourceMappingURL=auth.js.map