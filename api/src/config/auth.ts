import dotenv from 'dotenv';

dotenv.config();

export const JWT_SECRET: string = process.env.JWT_SECRET || 'default-secret-change-in-production';
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';
export const FRONTEND_URL: string = process.env.FRONTEND_URL || 'http://localhost:3000';
export const API_URL: string = process.env.API_URL || 'http://localhost:5555';
