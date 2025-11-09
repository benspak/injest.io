import type { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User.js';
import { hashApiKey } from '../utils/apiKeys.js';

const API_KEY_LIMIT = 400;
const WINDOW_MS = 60_000;
const usageMap = new Map<string, number[]>();

export interface ApiKeyRequest extends Request {
  apiUser?: {
    id: string;
    email: string;
  };
}

function extractApiKey(req: Request): string | null {
  const headerKey = req.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim().length > 0) {
    return headerKey.trim();
  }
  if (Array.isArray(headerKey) && headerKey.length > 0) {
    const first = headerKey.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (first) {
      return first.trim();
    }
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token.length > 0) {
      return token;
    }
  }

  return null;
}

function isRateLimited(hash: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = usageMap.get(hash)?.filter((timestamp) => timestamp > windowStart) ?? [];

  if (timestamps.length >= API_KEY_LIMIT) {
    usageMap.set(hash, timestamps);
    return true;
  }

  timestamps.push(now);
  usageMap.set(hash, timestamps);
  return false;
}

export async function apiKeyAuthMiddleware(req: ApiKeyRequest, res: Response, next: NextFunction) {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const apiKeyHash = hashApiKey(apiKey);
    const user = await UserModel.findByApiKeyHash(apiKeyHash);

    if (!user) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (isRateLimited(apiKeyHash)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 400 requests per minute.' });
    }

    req.apiUser = { id: user.id, email: user.email };
    req.user = req.apiUser;

    await UserModel.updateApiKeyLastUsed(user.id);

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ error: 'Failed to authenticate API key' });
  }
}
