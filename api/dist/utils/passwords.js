import bcrypt from 'bcrypt';
const SALT_ROUNDS = 12;
/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}
/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}
//# sourceMappingURL=passwords.js.map