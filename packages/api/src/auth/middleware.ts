import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { users, organizations, apiKeys } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { verifyPassword } from './password.js';

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Check for API key in header
  const apiKey = request.headers['x-api-key'] as string;

  if (apiKey) {
    const keyPrefix = apiKey.substring(0, 8);
    const keyHash = await hashApiKey(apiKey);

    const key = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.keyPrefix, keyPrefix),
    });

    if (key && key.keyHash === keyHash && (!key.expiresAt || key.expiresAt > new Date())) {
      // Update last used
      await db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, key.id));

      // Attach user and org to request
      const user = await db.query.users.findFirst({
        where: eq(users.id, key.userId),
      });

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, key.organizationId),
      });

      if (user && org) {
        request.user = {
          userId: user.id,
          organizationId: org.id,
          email: user.email,
          role: user.role,
        };
        return;
      }
    }

    reply.code(401).send({ error: 'Invalid API key' });
    return;
  }

  // Otherwise, use JWT authentication (handled by @fastify/jwt)
  if (!request.user) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}

async function hashApiKey(key: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(key).digest('hex');
}
