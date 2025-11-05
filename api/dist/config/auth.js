import dotenv from 'dotenv';
dotenv.config();
export const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
export const API_URL = process.env.API_URL || 'http://localhost:5555';
//# sourceMappingURL=auth.js.map