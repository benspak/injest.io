import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32; // 256 bits for key derivation
const TAG_LENGTH = 16; // 128 bits for authentication tag
const KEY_LENGTH = 32; // 256 bits for AES-256

/**
 * Derive encryption key from environment variable
 * Supports both base64 and hex encoded keys
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    throw new Error('ENCRYPTION_KEY environment variable is not set. Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
  }

  // Try to decode as base64 first, then hex
  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(key, 'base64');
    if (keyBuffer.length !== KEY_LENGTH) {
      // Try hex if base64 doesn't give us 32 bytes
      keyBuffer = Buffer.from(key, 'hex');
    }
  } catch {
    // If base64 fails, try hex
    keyBuffer = Buffer.from(key, 'hex');
  }

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be exactly ${KEY_LENGTH} bytes (32 bytes). Current length: ${keyBuffer.length} bytes`);
  }

  return keyBuffer;
}

/**
 * Derive a deterministic IV from plaintext for deterministic encryption
 * Uses HMAC to ensure same plaintext = same IV
 */
function getDeterministicIV(plaintext: string): Buffer {
  const masterKey = getEncryptionKey();
  const hmac = crypto.createHmac('sha256', masterKey);
  hmac.update('deterministic-iv-v1');
  hmac.update(plaintext);
  // Use first 16 bytes of HMAC as IV
  return hmac.digest().slice(0, IV_LENGTH);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @param deterministic - If true, uses deterministic encryption (same input = same output)
 * @returns Base64 encoded string: iv:tag:ciphertext (or salt:tag:ciphertext for deterministic)
 */
export function encrypt(plaintext: string, deterministic: boolean = false): string {
  if (!plaintext) {
    return plaintext;
  }

  try {
    if (deterministic) {
      // Deterministic encryption: use master key with deterministic IV
      // Same plaintext will always produce same ciphertext (for searchability)
      // Store the IV seed (hash of plaintext) so we can recompute IV for decryption
      const key = getEncryptionKey();
      const iv = getDeterministicIV(plaintext);

      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const tag = cipher.getAuthTag();

      // Store IV seed (first 8 bytes of plaintext hash) to enable decryption
      // Format: iv_seed:tag:ciphertext
      // We can recompute IV from the seed during decryption
      const ivSeed = crypto.createHash('sha256').update(plaintext.toLowerCase().trim()).digest().slice(0, 8).toString('base64');
      return `${ivSeed}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
    } else {
      // Non-deterministic encryption: random IV each time
      const key = getEncryptionKey();
      const iv = crypto.randomBytes(IV_LENGTH);

      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      const tag = cipher.getAuthTag();

      // Format: iv:tag:ciphertext (all base64)
      return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
    }
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decrypt ciphertext encrypted with encrypt()
 * Automatically detects deterministic vs non-deterministic based on format
 * @param ciphertext - Base64 encoded encrypted string
 * @returns Decrypted plaintext
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return ciphertext;
  }

  // Check if it's already plaintext (for backward compatibility during migration)
  // Encrypted data will have ':' separators and base64-encoded parts
  // Simple heuristic: if it doesn't contain ':', it's likely plaintext
  if (!ciphertext.includes(':')) {
    return ciphertext;
  }

  try {
    const parts = ciphertext.split(':');

    // Encrypted data should have exactly 3 parts (iv:tag:ciphertext or iv_seed:tag:ciphertext)
    if (parts.length !== 3) {
      // Likely plaintext that happens to contain ':'
      return ciphertext;
    }

    // Check if parts look like base64-encoded data
    // Base64 strings are typically longer and contain only base64 characters
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    const allPartsAreBase64 = parts.every(part => part.length > 0 && base64Regex.test(part));

    if (!allPartsAreBase64) {
      // Doesn't look like encrypted data, probably plaintext
      return ciphertext;
    }

    // Check if it's deterministic (has IV seed) or non-deterministic (has random IV)
    // Deterministic format: iv_seed:tag:ciphertext (iv_seed is 8 bytes = 12 base64 chars)
    // Non-deterministic format: iv:tag:ciphertext (iv is 16 bytes = 24 base64 chars)
    const firstPart = parts[0];

    if (firstPart.length <= 12) {
      // Deterministic encryption: iv_seed:tag:ciphertext
      // For deterministic decryption, we need the plaintext to recompute the IV
      // However, we can't decrypt without knowing the plaintext first
      // This is a limitation of deterministic encryption
      // In practice, for searchable fields:
      // - Use deterministic encryption for storage (same input = same output)
      // - When searching, encrypt the search term and compare
      // - For display, we typically already have the plaintext from context
      //   OR we store a non-deterministic version alongside

      // Since we can't decrypt deterministic encryption, return as-is
      // The caller should handle this case
      throw new Error('Deterministic encryption cannot be decrypted without the original plaintext. For fields that need both searchability and decryption, consider storing both deterministic (for search) and non-deterministic (for display) versions.');
    } else {
      // Non-deterministic encryption: iv:tag:ciphertext
      try {
        const iv = Buffer.from(firstPart, 'base64');
        const tag = Buffer.from(parts[1], 'base64');
        const encrypted = Buffer.from(parts[2], 'base64');

        // Validate IV length (should be 16 bytes for GCM)
        if (iv.length !== IV_LENGTH) {
          return ciphertext; // Probably not encrypted data
        }

        const key = getEncryptionKey();
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString('utf8');
      } catch (decryptError) {
        // If decryption fails (wrong key, corrupted data, etc.), return original
        // This handles cases where data looks encrypted but isn't, or is corrupted
        return ciphertext;
      }
    }
  } catch (error) {
    // If it's the deterministic encryption error, re-throw it
    if (error instanceof Error && error.message.includes('Deterministic encryption cannot be decrypted')) {
      throw error;
    }
    // For any other error, assume it's plaintext and return as-is
    return ciphertext;
  }
}

/**
 * Encrypt a field value (handles null)
 * @param value - Value to encrypt (string or null)
 * @param deterministic - Use deterministic encryption
 * @returns Encrypted value or null
 */
export function encryptField(value: string | null | undefined, deterministic: boolean = false): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return encrypt(value, deterministic);
}

/**
 * Decrypt a field value (handles null)
 * @param value - Encrypted value or null
 * @returns Decrypted value or null
 */
export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Check if it's already decrypted (for backward compatibility)
  if (!value.includes(':')) {
    return value;
  }

  try {
    return decrypt(value);
  } catch (error) {
    // If decryption fails, might be plaintext (during migration)
    // Return as-is and let the application handle it
    console.warn('Decryption failed, returning value as-is (might be plaintext):', error);
    return value;
  }
}

/**
 * Encrypt a JSON object
 * @param obj - Object to encrypt
 * @param deterministic - Use deterministic encryption for all fields
 * @returns Encrypted JSON string
 */
export function encryptJSON(obj: any, deterministic: boolean = false): string {
  if (!obj) {
    return '';
  }
  const jsonString = JSON.stringify(obj);
  return encrypt(jsonString, deterministic);
}

/**
 * Encrypt a value for searchable matching
 * Returns both the encrypted value (non-deterministic, decryptable) and a searchable hash
 * For fields that need to be both searchable AND decryptable, use this approach
 * @param plaintext - Value to encrypt
 * @returns Object with encrypted value and searchable hash
 */
export function encryptSearchable(plaintext: string): { encrypted: string; hash: string } {
  if (!plaintext) {
    return { encrypted: '', hash: '' };
  }

  // Create a searchable hash for exact matching (HMAC-based)
  const hash = createSearchableHash(plaintext);

  // Encrypt non-deterministically for storage (so we can decrypt later)
  const encrypted = encrypt(plaintext, false);

  return { encrypted, hash };
}

/**
 * Decrypt a searchable encrypted value
 * @param encrypted - Encrypted value (non-deterministic)
 * @returns Decrypted value
 */
export function decryptSearchable(encrypted: string): string {
  if (!encrypted) {
    return encrypted;
  }

  // Decrypt as non-deterministic
  return decrypt(encrypted);
}

/**
 * Create a searchable hash for a value (for exact match searching)
 * @param value - Value to hash
 * @returns Hex-encoded hash
 */
export function createSearchableHash(value: string): string {
  if (!value) {
    return '';
  }
  const key = getEncryptionKey();
  const hmac = crypto.createHmac('sha256', key);
  hmac.update('searchable-hash-v1');
  hmac.update(value.toLowerCase().trim());
  return hmac.digest('hex');
}

/**
 * Decrypt and parse a JSON object
 * @param encryptedJson - Encrypted JSON string
 * @returns Parsed object
 */
export function decryptJSON(encryptedJson: string): any {
  if (!encryptedJson) {
    return null;
  }

  try {
    const decrypted = decrypt(encryptedJson);
    return JSON.parse(decrypted);
  } catch (error) {
    // Might be plaintext JSON during migration
    try {
      return JSON.parse(encryptedJson);
    } catch {
      throw new Error(`Failed to decrypt/parse JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
