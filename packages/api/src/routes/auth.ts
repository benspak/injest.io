import { Router } from 'express';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { generateToken } from '../auth/jwt.js';

export const authRouter = Router();

// Google OAuth callback (simplified - you'd integrate with Passport or similar)
authRouter.post('/auth/google', async (req, res) => {
  try {
    const { email, name, avatar, googleId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Find or create user
    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email,
          name,
          avatar,
          googleId,
        })
        .returning();
    } else {
      // Update existing user
      [user] = await db
        .update(users)
        .set({ name, avatar, googleId })
        .where(eq(users.id, user.id))
        .returning();
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Magic Link login (simplified - send email)
authRouter.post('/auth/magic-link', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Generate token for magic link
    const token = generateToken({ userId: email, email }); // Simplified
    const magicLink = `${process.env.BASE_URL}/auth/verify?token=${token}`;

    // In production, send email here
    console.log(`Magic link for ${email}: ${magicLink}`);

    res.json({ message: 'Check your email for login link', link: magicLink });
  } catch (error) {
    console.error('Magic link error:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// Verify magic link token
authRouter.get('/auth/verify', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    // Find or create user
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const { email } = payload;

    let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      [user] = await db.insert(users).values({ email }).returning();
    }

    const authToken = generateToken({ userId: user.id, email: user.email });

    res.json({
      token: authToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});
