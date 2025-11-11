import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/auth.js';
import { UserModel } from '../models/User.js';
import { hashApiKey } from '../utils/apiKeys.js';
import { coerceSubscriptionTier, PAID_TIERS } from '../utils/subscriptionPlans.js';
function extractBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }
    if (req.query?.token) {
        const tokenQuery = req.query.token;
        if (typeof tokenQuery === 'string' && tokenQuery.trim().length > 0) {
            return tokenQuery.trim();
        }
    }
    return null;
}
function extractApiKey(req) {
    const apiKeyHeader = req.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim().length > 0) {
        return apiKeyHeader.trim();
    }
    if (Array.isArray(apiKeyHeader)) {
        const value = apiKeyHeader.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
        if (value) {
            return value.trim();
        }
    }
    if (req.query?.apiKey) {
        const apiKeyQuery = req.query.apiKey;
        if (typeof apiKeyQuery === 'string' && apiKeyQuery.trim().length > 0) {
            return apiKeyQuery.trim();
        }
    }
    return null;
}
function hasPlusAccess(user) {
    if (!user) {
        return false;
    }
    if (user.is_premium) {
        return true;
    }
    const tier = coerceSubscriptionTier(user.subscription_tier);
    return PAID_TIERS.includes(tier);
}
export async function requirePlusTier(req, res, next) {
    try {
        let user = null;
        const bearerToken = extractBearerToken(req);
        if (bearerToken) {
            try {
                const decoded = jwt.verify(bearerToken, JWT_SECRET);
                user = await UserModel.findById(decoded.userId);
            }
            catch (error) {
                if (error instanceof jwt.JsonWebTokenError) {
                    res.status(401).json({ error: 'Invalid token provided' });
                    return;
                }
                throw error;
            }
        }
        if (!user) {
            const apiKey = extractApiKey(req);
            if (apiKey) {
                const apiKeyHash = hashApiKey(apiKey);
                user = await UserModel.findByApiKeyHash(apiKeyHash);
                if (user) {
                    req.user = {
                        id: user.id,
                        email: user.email,
                    };
                }
            }
        }
        if (!user || !user.verified) {
            res.status(401).json({ error: 'Authentication required to access API documentation' });
            return;
        }
        if (!hasPlusAccess(user)) {
            res.status(403).json({ error: 'A Plus subscription or higher is required to access API documentation' });
            return;
        }
        req.user = {
            id: user.id,
            email: user.email,
        };
        next();
    }
    catch (error) {
        console.error('Error enforcing Plus tier access:', error);
        res.status(500).json({ error: 'Failed to verify API documentation access' });
    }
}
//# sourceMappingURL=requirePlusTier.js.map