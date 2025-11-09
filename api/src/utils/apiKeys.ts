import crypto from 'crypto';

export const API_KEY_PREFIX = 'inj_';

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 8) {
    return apiKey;
  }
  const visible = apiKey.slice(-4);
  return `${API_KEY_PREFIX}***${visible}`;
}
