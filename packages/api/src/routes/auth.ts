import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { users, organizations, apiKeys } from '../db/schema.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { isValidEmail } from '@brain/shared';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  organizationName: z.string().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createApiKeySchema = z.object({
  name: z.string().min(1),
  expiresInDays: z.number().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    if (existingUser) {
      return reply.code(400).send({ error: 'User already exists' });
    }

    // Create organization
    const orgSlug = body.organizationName
      ? body.organizationName.toLowerCase().replace(/\s+/g, '-')
      : `org-${Date.now()}`;

    const [org] = await db.insert(organizations).values({
      name: body.organizationName || 'My Organization',
      slug: orgSlug,
    }).returning();

    // Create user
    const passwordHash = await hashPassword(body.password);
    const [user] = await db.insert(users).values({
      email: body.email,
      name: body.name,
      passwordHash,
      organizationId: org.id,
      role: 'admin',
    }).returning();

    // Generate JWT token
    const token = app.jwt.sign({
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: org.id,
        },
        token,
      },
    };
  });

  // Login
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await db.query.users.findFirst({
      where: eq(users.email, body.email),
    });

    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(body.password, user.passwordHash);

    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.organizationId),
    });

    if (!org) {
      return reply.code(500).send({ error: 'Organization not found' });
    }

    const token = app.jwt.sign({
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: org.id,
        },
        token,
      },
    };
  });

  // Create API Key
  app.post('/auth/api-keys', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const body = createApiKeySchema.parse(request.body);

    // Generate API key (32 bytes, base64 encoded)
    const apiKeyBytes = randomBytes(32);
    const apiKey = `brn_${apiKeyBytes.toString('base64url')}`;
    const keyPrefix = apiKey.substring(0, 8);

    // Hash the key for storage
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const [key] = await db.insert(apiKeys).values({
      userId: request.user.userId,
      organizationId: request.user.organizationId,
      name: body.name,
      keyHash,
      keyPrefix,
      expiresAt,
      permissions: body.permissions || ['read', 'write'],
    }).returning();

    // Return the API key only once (it's hashed, so we can't retrieve it later)
    return {
      success: true,
      data: {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        apiKey, // Only returned once
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
    };
  });

  // List API Keys
  app.get('/auth/api-keys', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, request.user.userId),
    });

    return {
      success: true,
      data: keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      })),
    };
  });

  // Delete API Key
  app.delete('/auth/api-keys/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    const key = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, id),
    });

    if (!key || key.userId !== request.user.userId) {
      return reply.code(404).send({ error: 'API key not found' });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    return { success: true };
  });
}
