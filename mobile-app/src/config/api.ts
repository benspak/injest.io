// API Configuration
// In React Native, environment variables need to be accessed differently
// For now, using a default that can be overridden
export const API_URL = __DEV__
  ? 'http://localhost:5555'
  : 'https://injest-api.onrender.com';

export interface ApiError {
  error: string;
  details?: string;
  status?: number;
}

export class ApiClientError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.data = data;
  }
}
