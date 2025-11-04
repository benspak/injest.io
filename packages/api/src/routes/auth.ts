import { Router, Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Resend } from 'resend';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { signToken } from '../auth/jwt.js';
import crypto from 'crypto';

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// Magic link tokens (in production, use Redis)
const magicLinkTokens = new Map<string, { userId: string; expiresAt: number }>();

// Configure Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found'), undefined);
        }

        // Find or create user
        let user = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (user.length === 0) {
          const [newUser] = await db
            .insert(users)
            .values({
              email,
              googleId: profile.id,
            })
            .returning();
          user = [newUser];
        } else if (!user[0].googleId) {
          // Update existing user with Google ID
          await db.update(users).set({ googleId: profile.id }).where(eq(users.id, user[0].id));
        }

        done(null, user[0]);
      } catch (error) {
        done(error, undefined);
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
    done(null, user || null);
  } catch (error) {
    done(error, null);
  }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req: any, res: Response) => {
    if (!req.user) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }

    const token = signToken({
      userId: req.user.id,
      email: req.user.email,
    });

    // Set cookie and redirect
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

// Magic Link
router.post('/magic-link', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Find or create user
    let user = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (user.length === 0) {
      const [newUser] = await db
        .insert(users)
        .values({
          email,
        })
        .returning();
      user = [newUser];
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    magicLinkTokens.set(token, {
      userId: user[0].id,
      expiresAt,
    });

    // Send email
    const magicLink = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
      to: email,
      subject: 'Sign in to Injest.io',
      html: `
        <h2>Sign in to Injest.io</h2>
        <p>Click the link below to sign in:</p>
        <a href="${magicLink}">${magicLink}</a>
        <p>This link expires in 15 minutes.</p>
      `,
    });

    res.json({ message: 'Magic link sent to your email' });
  } catch (error: any) {
    console.error('Magic link error:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

router.get('/verify/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const tokenData = magicLinkTokens.get(token);

    if (!tokenData) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?reason=invalid_token`);
    }

    if (Date.now() > tokenData.expiresAt) {
      magicLinkTokens.delete(token);
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error?reason=expired`);
    }

    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, tokenData.userId)).limit(1);

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
    }

    // Delete used token
    magicLinkTokens.delete(token);

    // Sign JWT
    const jwtToken = signToken({
      userId: user.id,
      email: user.email,
    });

    // Set cookie and redirect
    res.cookie('token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (error) {
    console.error('Verify error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
});

export default router;
