/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @param deterministic - If true, uses deterministic encryption (same input = same output)
 * @returns Base64 encoded string: iv:tag:ciphertext (or salt:tag:ciphertext for deterministic)
 */
export declare function encrypt(plaintext: string, deterministic?: boolean): string;
/**
 * Decrypt ciphertext encrypted with encrypt()
 * Automatically detects deterministic vs non-deterministic based on format
 * @param ciphertext - Base64 encoded encrypted string
 * @returns Decrypted plaintext
 */
export declare function decrypt(ciphertext: string): string;
/**
 * Encrypt a field value (handles null)
 * @param value - Value to encrypt (string or null)
 * @param deterministic - Use deterministic encryption
 * @returns Encrypted value or null
 */
export declare function encryptField(value: string | null | undefined, deterministic?: boolean): string | null;
/**
 * Decrypt a field value (handles null)
 * @param value - Encrypted value or null
 * @returns Decrypted value or null
 */
export declare function decryptField(value: string | null | undefined): string | null;
/**
 * Encrypt a JSON object
 * @param obj - Object to encrypt
 * @param deterministic - Use deterministic encryption for all fields
 * @returns Encrypted JSON string
 */
export declare function encryptJSON(obj: any, deterministic?: boolean): string;
/**
 * Encrypt a value for searchable matching
 * Returns both the encrypted value (non-deterministic, decryptable) and a searchable hash
 * For fields that need to be both searchable AND decryptable, use this approach
 * @param plaintext - Value to encrypt
 * @returns Object with encrypted value and searchable hash
 */
export declare function encryptSearchable(plaintext: string): {
    encrypted: string;
    hash: string;
};
/**
 * Decrypt a searchable encrypted value
 * @param encrypted - Encrypted value (non-deterministic)
 * @returns Decrypted value
 */
export declare function decryptSearchable(encrypted: string): string;
/**
 * Create a searchable hash for a value (for exact match searching)
 * @param value - Value to hash
 * @returns Hex-encoded hash
 */
export declare function createSearchableHash(value: string): string;
/**
 * Decrypt and parse a JSON object
 * @param encryptedJson - Encrypted JSON string
 * @returns Parsed object
 */
export declare function decryptJSON(encryptedJson: string): any;
//# sourceMappingURL=encryption.d.ts.map