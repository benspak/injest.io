import dotenv from 'dotenv';

dotenv.config();

/**
 * Validate encryption key configuration
 * Ensures ENCRYPTION_KEY is set and valid
 */
export function validateEncryptionKey(): void {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required in production. ' +
        'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
      );
    }
    console.warn(
      'WARNING: ENCRYPTION_KEY is not set. Encryption features will not work. ' +
      'Generate a key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
    return;
  }

  // Validate key length (should be 32 bytes when decoded)
  let keyLength: number;
  try {
    const base64Key = Buffer.from(key, 'base64');
    keyLength = base64Key.length;
    if (keyLength !== 32) {
      // Try hex
      const hexKey = Buffer.from(key, 'hex');
      keyLength = hexKey.length;
    }
  } catch {
    // Try hex
    try {
      const hexKey = Buffer.from(key, 'hex');
      keyLength = hexKey.length;
    } catch {
      throw new Error('ENCRYPTION_KEY must be base64 or hex encoded');
    }
  }

  if (keyLength !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (256 bits). ` +
      `Current length: ${keyLength} bytes. ` +
      `Generate a key using: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    );
  }

  if (process.env.NODE_ENV === 'production' && key.includes('your-') || key.includes('change-in-production')) {
    console.warn('WARNING: ENCRYPTION_KEY appears to be a placeholder. This should be changed in production!');
  }
}

// Validate on module load
validateEncryptionKey();
