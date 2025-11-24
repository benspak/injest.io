import dotenv from 'dotenv';
dotenv.config();
// Validate JWT_SECRET - fail fast in production
if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set in production environment');
    }
    console.warn('WARNING: Using default JWT_SECRET. This should never be used in production!');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
export const API_URL = process.env.API_URL || 'http://localhost:5555';
//# sourceMappingURL=auth.js.map