import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

export async function encrypt(text: string, key: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scryptAsync(key, salt, 32)) as Buffer;
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const tag = cipher.getAuthTag();

  // Return: salt:iv:tag:encrypted (all base64)
  return Buffer.concat([
    salt,
    iv,
    tag,
    encrypted,
  ]).toString('base64');
}

export async function decrypt(encryptedData: string, key: string): Promise<string> {
  const data = Buffer.from(encryptedData, 'base64');

  const salt = data.subarray(0, SALT_LENGTH);
  const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const derivedKey = (await scryptAsync(key, salt, 32)) as Buffer;

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}
