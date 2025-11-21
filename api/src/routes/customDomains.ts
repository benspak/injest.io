import express from 'express';
import crypto from 'crypto';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { CustomDomainModel, type CustomDomain } from '../models/CustomDomain.js';
import { UserModel } from '../models/User.js';
import { isPaidTier, coerceSubscriptionTier } from '../utils/subscriptionPlans.js';
import { verifyTxtRecord, getTxtRecordName, getDefaultCnameTarget } from '../services/dnsVerification.js';

const router = express.Router();

// Reserved domains that cannot be used
const RESERVED_DOMAINS = [
  'injest.io',
  'www.injest.io',
  'app.injest.io',
  'api.injest.io',
  'localhost',
  '127.0.0.1',
];

// Validate domain format (RFC 1035 compliant)
function validateDomain(domain: string): { valid: boolean; error?: string } {
  if (!domain || domain.trim().length === 0) {
    return { valid: false, error: 'Domain is required' };
  }

  const trimmed = domain.trim().toLowerCase();

  // Check reserved domains
  if (RESERVED_DOMAINS.includes(trimmed)) {
    return { valid: false, error: 'This domain is reserved and cannot be used' };
  }

  // Basic domain format validation
  // Allow letters, numbers, dots, and hyphens
  // Must start and end with alphanumeric
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

  if (!domainRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid domain format' };
  }

  // Check length (max 253 characters for FQDN)
  if (trimmed.length > 253) {
    return { valid: false, error: 'Domain is too long (maximum 253 characters)' };
  }

  // Check individual label length (max 63 characters)
  const labels = trimmed.split('.');
  for (const label of labels) {
    if (label.length > 63) {
      return { valid: false, error: 'Domain label is too long (maximum 63 characters per label)' };
    }
  }

  return { valid: true };
}

// Middleware to check if user is pro tier
async function requireProTier(req: AuthRequest, res: express.Response, next: express.NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const tier = coerceSubscriptionTier(user.subscription_tier);
    const isPro = isPaidTier(tier) || user.is_premium;

    if (!isPro) {
      res.status(403).json({ error: 'Pro subscription required to use custom domains' });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking pro tier:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
}

// GET /api/custom-domains - List user's custom domains
router.get('/', authMiddleware, requireProTier, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const domains = await CustomDomainModel.findByUserId(req.user.id);
    res.json({ domains });
  } catch (error) {
    console.error('Error fetching custom domains:', error);
    res.status(500).json({ error: 'Failed to fetch custom domains' });
  }
});

// POST /api/custom-domains - Add new custom domain
router.post('/', authMiddleware, requireProTier, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { domain } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Validate domain format
    const validation = validateDomain(domain);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const normalizedDomain = domain.trim().toLowerCase();

    // Check if domain already exists
    const existing = await CustomDomainModel.findByDomain(normalizedDomain);
    if (existing) {
      if (existing.user_id === req.user.id) {
        return res.status(400).json({ error: 'You already have this domain configured' });
      }
      return res.status(400).json({ error: 'This domain is already in use' });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Get default CNAME target
    const cnameTarget = getDefaultCnameTarget();

    // Create custom domain
    const customDomain = await CustomDomainModel.create(
      req.user.id,
      normalizedDomain,
      verificationToken,
      cnameTarget
    );

    // Return domain with verification instructions
    const txtRecordName = getTxtRecordName(normalizedDomain);
    res.status(201).json({
      domain: customDomain,
      verification: {
        txtRecordName,
        txtRecordValue: verificationToken,
        cnameTarget,
        instructions: `Add a TXT record: ${txtRecordName} with value "${verificationToken}"`,
      },
    });
  } catch (error: any) {
    console.error('Error creating custom domain:', error);
    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(400).json({ error: 'This domain is already in use' });
    }
    res.status(500).json({ error: 'Failed to create custom domain' });
  }
});

// POST /api/custom-domains/:id/verify - Verify domain via DNS check
router.post('/:id/verify', authMiddleware, requireProTier, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const customDomain = await CustomDomainModel.findById(id);
    if (!customDomain) {
      return res.status(404).json({ error: 'Custom domain not found' });
    }

    // Verify ownership
    if (customDomain.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify TXT record
    const isVerified = await verifyTxtRecord(customDomain.domain, customDomain.verification_token);

    if (isVerified) {
      // Update domain as verified and active
      const updated = await CustomDomainModel.update(customDomain.id, {
        verified: true,
        verified_at: new Date(),
        is_active: true,
      });

      res.json({
        domain: updated,
        verified: true,
        message: 'Domain verified successfully',
      });
    } else {
      res.json({
        domain: customDomain,
        verified: false,
        message: 'TXT record not found or does not match. Please ensure the TXT record is correctly configured.',
      });
    }
  } catch (error) {
    console.error('Error verifying custom domain:', error);
    res.status(500).json({ error: 'Failed to verify domain' });
  }
});

// PUT /api/custom-domains/:id - Update domain config
router.put('/:id', authMiddleware, requireProTier, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { is_active } = req.body;

    const customDomain = await CustomDomainModel.findById(id);
    if (!customDomain) {
      return res.status(404).json({ error: 'Custom domain not found' });
    }

    // Verify ownership
    if (customDomain.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only allow updating is_active if domain is verified
    const updates: Partial<CustomDomain> = {};
    if (typeof is_active === 'boolean' && customDomain.verified) {
      updates.is_active = is_active;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const updated = await CustomDomainModel.update(id, updates);
    res.json({ domain: updated });
  } catch (error) {
    console.error('Error updating custom domain:', error);
    res.status(500).json({ error: 'Failed to update custom domain' });
  }
});

// DELETE /api/custom-domains/:id - Remove custom domain
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: express.Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const customDomain = await CustomDomainModel.findById(id);
    if (!customDomain) {
      return res.status(404).json({ error: 'Custom domain not found' });
    }

    // Verify ownership
    if (customDomain.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await CustomDomainModel.delete(id);
    res.json({ message: 'Custom domain deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom domain:', error);
    res.status(500).json({ error: 'Failed to delete custom domain' });
  }
});

export default router;
