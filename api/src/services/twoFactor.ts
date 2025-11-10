import crypto from 'crypto';
import { authenticator } from 'otplib';

const APP_NAME = 'Injest.io';

export interface TwoFactorSecret {
  secret: string;
  otpauthUrl: string;
}

export function generateTwoFactorSecret(email: string): TwoFactorSecret {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, APP_NAME, secret);

  return { secret, otpauthUrl };
}

export function verifyTwoFactorToken(secret: string, token: string): boolean {
  if (!secret || !token) {
    return false;
  }
  return authenticator.verify({ token: token.replace(/\s+/g, ''), secret });
}

export function generateRecoveryCodes(count: number = 10): string[] {
  return Array.from({ length: count }, () => generateRecoveryCode());
}

export function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(5);
  const code = bytes.toString('hex');
  return code.toUpperCase().match(/.{1,4}/g)?.join('-') ?? code.toUpperCase();
}

export function normalizeRecoveryCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  const normalized = normalizeRecoveryCode(code);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function verifyRecoveryCode(hashedCodes: string[] | null | undefined, code: string): {
  valid: boolean;
  remaining: string[] | null;
} {
  if (!hashedCodes || hashedCodes.length === 0) {
    return { valid: false, remaining: hashedCodes ?? null };
  }

  const hashed = hashRecoveryCode(code);
  const index = hashedCodes.findIndex((stored) => stored === hashed);

  if (index === -1) {
    return { valid: false, remaining: hashedCodes };
  }

  const remaining = [...hashedCodes];
  remaining.splice(index, 1);

  return { valid: true, remaining };
}
