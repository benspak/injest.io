import express from 'express';
import { UserModel } from '../models/User.js';
import { emailService } from '../services/email.js';
import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, FRONTEND_URL } from '../config/auth.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Send magic link
router.post('/magic-link', async (req: express.Request, res: express.Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find or create user
    let user = await UserModel.findByEmail(email);
    if (!user) {
      user = await UserModel.create(email);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    // Send magic link email
    const magicLink = `${FRONTEND_URL}/auth/verify?token=${token}`;
    await emailService.sendMagicLink(email, magicLink);

    res.json({ message: 'Magic link sent to your email' });
  } catch (error) {
    console.error('Error sending magic link:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// Verify magic link token
router.get('/verify', async (req: express.Request, res: express.Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    // Get user before verification
    const userBefore = await UserModel.findById(decoded.userId);

    // Verify user email
    const user = await UserModel.verifyEmail(decoded.userId);

    // Send approval email if this is the first verification
    if (userBefore && !userBefore.verified && user.verified) {
      await emailService.sendApprovalEmail(user.email);
    }

    // Generate new JWT for authenticated session
    const sessionToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        is_premium: user.is_premium || false,
      }
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    console.error('Error verifying token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

// Get current user (requires auth middleware)
router.get('/me', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        verified: user.verified,
        is_premium: user.is_premium || false,
      }
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ error: 'Failed to get current user' });
  }
});

export default router;
