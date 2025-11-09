import crypto from 'crypto';
export const API_KEY_PREFIX = 'inj_';
export function generateApiKey() {
    return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}
export function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
}
export function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length <= 8) {
        return apiKey;
    }
    const visible = apiKey.slice(-4);
    return `${API_KEY_PREFIX}***${visible}`;
}
//# sourceMappingURL=apiKeys.js.map