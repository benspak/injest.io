import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Resend } from 'resend';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { signToken } from '../auth/jwt.js';
import { nanoid } from 'nanoid';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await db
          .select()
          .from(users)
          .where(eq(users.googleId, profile.id))
          .limit(1)
          .then((rows) => rows[0]);

        if (!user) {
          // Check if user exists by email
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, profile.emails?.[0]?.value || ''))
            .limit(1)
            .then((rows) => rows[0]);

          if (existingUser) {
            // Update existing user with Google ID
            [user] = await db
              .update(users)
              .set({ googleId: profile.id })
              .where(eq(users.id, existingUser.id))
              .returning();
          } else {
            // Create new user
            [user] = await db
              .insert(users)
              .values({
                email: profile.emails?.[0]?.value || '',
                name: profile.displayName,
                googleId: profile.id,
              })
              .returning();
          }
        }

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const user = req.user as typeof users.$inferSelect;
    const token = signToken({ userId: user.id, email: user.email });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`);
  }
);

// Magic Link
router.post('/magic-link', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find or create user
    let user = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
      .then((rows) => rows[0]);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email })
        .returning();
    }

    // Generate magic link token
    const magicToken = nanoid(32);
    const token = signToken({ userId: user.id, email: user.email });

    // Store magic token temporarily (in production, use Redis)
    // For MVP, we'll send the token directly in the email

    const magicLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`;

    // Send email via Resend
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Sign in to Injest.io',
      html: `
        <h2>Sign in to Injest.io</h2>
        <p>Click the link below to sign in:</p>
        <a href="${magicLink}">Sign In</a>
        <p>This link expires in 1 hour.</p>
      `,
    });

    res.json({ message: 'Magic link sent to your email' });
  } catch (error: any) {
    console.error('Magic link error:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// Verify token endpoint
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../auth/jwt.js');
    const payload = verifyToken(token);

    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
