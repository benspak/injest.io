import pool from '../config/database.js';
import { encryptField, decryptField } from '../utils/encryption.js';
export class UserModel {
    /**
     * Decrypt encrypted fields from database result
     * Handles both encrypted and unencrypted data (for migration compatibility)
     */
    static decryptUserData(user) {
        if (!user) {
            return user;
        }
        return {
            ...user,
            // Encrypted PII fields (deterministic for email, opaque for others)
            email: decryptField(user.email) || user.email, // Deterministic (handled automatically by decrypt)
            recovery_email: decryptField(user.recovery_email) || user.recovery_email, // Deterministic (handled automatically by decrypt)
            first_name: decryptField(user.first_name) || user.first_name, // Opaque
            last_name: decryptField(user.last_name) || user.last_name, // Opaque
            date_of_birth: user.date_of_birth, // Date, no encryption needed
            zip_code: decryptField(user.zip_code) || user.zip_code, // Opaque
            city: decryptField(user.city) || user.city, // Opaque
            // Encrypted secrets
            two_factor_secret: decryptField(user.two_factor_secret) || user.two_factor_secret, // Opaque
        };
    }
    /**
     * Get decrypted two_factor_secret for a user
     * Use this when you need the actual secret value (e.g., for verification)
     */
    static async getDecryptedTwoFactorSecret(userId) {
        const user = await this.findById(userId);
        if (!user) {
            return null;
        }
        return decryptField(user.two_factor_secret);
    }
    static async findByEmail(email) {
        // Encrypt email for search (deterministic encryption allows exact match)
        const encryptedEmail = encryptField(email.toLowerCase(), true);
        if (!encryptedEmail) {
            return null;
        }
        // Search using encrypted email
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [encryptedEmail]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptUserData(result.rows[0]);
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptUserData(result.rows[0]);
    }
    static async create(email) {
        // Encrypt email before storing
        const encryptedEmail = encryptField(email.toLowerCase(), true);
        if (!encryptedEmail) {
            throw new Error('Email is required');
        }
        const result = await pool.query('INSERT INTO users (email, verified) VALUES ($1, $2) RETURNING *', [encryptedEmail, false]);
        return this.decryptUserData(result.rows[0]);
    }
    static async createWithPassword(email, passwordHash, recoveryEmail, profileData) {
        const result = await pool.query(`INSERT INTO users (
        email, verified, password_hash, recovery_email,
        public_username, inbound_email_handle,
        first_name, last_name, date_of_birth, headline, bio, company,
        project_title, project_description, zip_code,
        x_profile_url, youtube_url, github_url, linkedin_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`, [
            encryptField(email.toLowerCase(), true), // Deterministic encryption
            true, // Auto-verify users created with password
            passwordHash,
            encryptField(recoveryEmail?.toLowerCase(), true), // Deterministic encryption
            profileData.public_username,
            profileData.public_username, // inbound_email_handle = public_username
            encryptField(profileData.first_name), // Opaque encryption
            encryptField(profileData.last_name), // Opaque encryption
            profileData.date_of_birth || null,
            profileData.headline || null,
            profileData.bio || null,
            profileData.company || null,
            profileData.project_title || null,
            profileData.project_description || null,
            encryptField(profileData.zip_code), // Opaque encryption
            profileData.x_profile_url || null,
            profileData.youtube_url || null,
            profileData.github_url || null,
            profileData.linkedin_url || null,
        ]);
        return this.decryptUserData(result.rows[0]);
    }
    static async verifyEmail(id) {
        const result = await pool.query('UPDATE users SET verified = TRUE WHERE id = $1 RETURNING *', [id]);
        return this.decryptUserData(result.rows[0]);
    }
    static async update(id, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (updates.email !== undefined) {
            fields.push(`email = $${paramCount++}`);
            values.push(encryptField(updates.email.toLowerCase(), true)); // Deterministic encryption
        }
        if (updates.verified !== undefined) {
            fields.push(`verified = $${paramCount++}`);
            values.push(updates.verified);
        }
        if (updates.is_premium !== undefined) {
            fields.push(`is_premium = $${paramCount++}`);
            values.push(updates.is_premium);
        }
        if (updates.subscription_tier !== undefined) {
            fields.push(`subscription_tier = $${paramCount++}`);
            values.push(updates.subscription_tier);
        }
        if (updates.stripe_customer_id !== undefined) {
            fields.push(`stripe_customer_id = $${paramCount++}`);
            values.push(updates.stripe_customer_id);
        }
        if (updates.bookmark_import_count !== undefined) {
            fields.push(`bookmark_import_count = $${paramCount++}`);
            values.push(updates.bookmark_import_count);
        }
        if (updates.last_bookmark_import_payment !== undefined) {
            fields.push(`last_bookmark_import_payment = $${paramCount++}`);
            values.push(updates.last_bookmark_import_payment);
        }
        if (updates.api_key_hash !== undefined) {
            fields.push(`api_key_hash = $${paramCount++}`);
            values.push(updates.api_key_hash);
        }
        if (updates.api_key_created_at !== undefined) {
            fields.push(`api_key_created_at = $${paramCount++}`);
            values.push(updates.api_key_created_at);
        }
        if (updates.api_key_last_used_at !== undefined) {
            fields.push(`api_key_last_used_at = $${paramCount++}`);
            values.push(updates.api_key_last_used_at);
        }
        if (updates.two_factor_enabled !== undefined) {
            fields.push(`two_factor_enabled = $${paramCount++}`);
            values.push(updates.two_factor_enabled);
        }
        if (updates.two_factor_secret !== undefined) {
            fields.push(`two_factor_secret = $${paramCount++}`);
            values.push(encryptField(updates.two_factor_secret));
        }
        if (updates.two_factor_confirmed_at !== undefined) {
            fields.push(`two_factor_confirmed_at = $${paramCount++}`);
            values.push(updates.two_factor_confirmed_at);
        }
        if (updates.two_factor_recovery_codes !== undefined) {
            fields.push(`two_factor_recovery_codes = $${paramCount++}`);
            values.push(updates.two_factor_recovery_codes);
        }
        if (updates.public_username !== undefined) {
            fields.push(`public_username = $${paramCount++}`);
            values.push(updates.public_username);
        }
        if (updates.first_name !== undefined) {
            fields.push(`first_name = $${paramCount++}`);
            values.push(encryptField(updates.first_name)); // Opaque encryption
        }
        if (updates.last_name !== undefined) {
            fields.push(`last_name = $${paramCount++}`);
            values.push(encryptField(updates.last_name)); // Opaque encryption
        }
        if (updates.headline !== undefined) {
            fields.push(`headline = $${paramCount++}`);
            values.push(updates.headline);
        }
        if (updates.bio !== undefined) {
            fields.push(`bio = $${paramCount++}`);
            values.push(updates.bio);
        }
        if (updates.company !== undefined) {
            fields.push(`company = $${paramCount++}`);
            values.push(updates.company);
        }
        if (updates.project_title !== undefined) {
            fields.push(`project_title = $${paramCount++}`);
            values.push(updates.project_title);
        }
        if (updates.project_description !== undefined) {
            fields.push(`project_description = $${paramCount++}`);
            values.push(updates.project_description);
        }
        if (updates.zip_code !== undefined) {
            fields.push(`zip_code = $${paramCount++}`);
            values.push(encryptField(updates.zip_code)); // Opaque encryption
        }
        if (updates.city !== undefined) {
            fields.push(`city = $${paramCount++}`);
            values.push(encryptField(updates.city)); // Opaque encryption
        }
        if (updates.avatar_url !== undefined) {
            fields.push(`avatar_url = $${paramCount++}`);
            values.push(updates.avatar_url);
        }
        if (updates.x_profile_url !== undefined) {
            fields.push(`x_profile_url = $${paramCount++}`);
            values.push(updates.x_profile_url);
        }
        if (updates.youtube_url !== undefined) {
            fields.push(`youtube_url = $${paramCount++}`);
            values.push(updates.youtube_url);
        }
        if (updates.github_url !== undefined) {
            fields.push(`github_url = $${paramCount++}`);
            values.push(updates.github_url);
        }
        if (updates.linkedin_url !== undefined) {
            fields.push(`linkedin_url = $${paramCount++}`);
            values.push(updates.linkedin_url);
        }
        if (updates.inbound_email_handle !== undefined) {
            fields.push(`inbound_email_handle = $${paramCount++}`);
            values.push(updates.inbound_email_handle);
        }
        if (updates.profile_private !== undefined) {
            fields.push(`profile_private = $${paramCount++}`);
            values.push(updates.profile_private);
        }
        if (updates.password_hash !== undefined) {
            fields.push(`password_hash = $${paramCount++}`);
            values.push(updates.password_hash);
        }
        if (updates.recovery_email !== undefined) {
            fields.push(`recovery_email = $${paramCount++}`);
            values.push(encryptField(updates.recovery_email?.toLowerCase(), true)); // Deterministic encryption
        }
        if (updates.date_of_birth !== undefined) {
            fields.push(`date_of_birth = $${paramCount++}`);
            values.push(updates.date_of_birth);
        }
        if (updates.referral_code !== undefined) {
            fields.push(`referral_code = $${paramCount++}`);
            values.push(updates.referral_code);
        }
        if (updates.stripe_connect_account_id !== undefined) {
            fields.push(`stripe_connect_account_id = $${paramCount++}`);
            values.push(updates.stripe_connect_account_id);
        }
        if (fields.length === 0) {
            return await this.findById(id);
        }
        values.push(id);
        const result = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        return this.decryptUserData(result.rows[0]);
    }
    static async setApiKey(userId, apiKeyHash) {
        return await this.update(userId, {
            api_key_hash: apiKeyHash,
            api_key_created_at: new Date(),
            api_key_last_used_at: null,
        });
    }
    static async clearApiKey(userId) {
        return await this.update(userId, {
            api_key_hash: null,
            api_key_created_at: null,
            api_key_last_used_at: null,
        });
    }
    static async updateApiKeyLastUsed(userId) {
        await pool.query('UPDATE users SET api_key_last_used_at = NOW() WHERE id = $1', [userId]);
    }
    static async findByApiKeyHash(apiKeyHash) {
        const result = await pool.query('SELECT * FROM users WHERE api_key_hash = $1 AND api_key_hash IS NOT NULL', [apiKeyHash]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptUserData(result.rows[0]);
    }
    static async saveTwoFactorSecret(userId, secret) {
        return await this.update(userId, {
            two_factor_secret: secret,
            two_factor_enabled: false,
            two_factor_confirmed_at: null,
            two_factor_recovery_codes: null,
        });
    }
    static async enableTwoFactor(userId, secret, recoveryCodes) {
        return await this.update(userId, {
            two_factor_secret: secret,
            two_factor_enabled: true,
            two_factor_confirmed_at: new Date(),
            two_factor_recovery_codes: recoveryCodes,
        });
    }
    static async disableTwoFactor(userId) {
        return await this.update(userId, {
            two_factor_secret: null,
            two_factor_enabled: false,
            two_factor_confirmed_at: null,
            two_factor_recovery_codes: null,
        });
    }
    static async updateRecoveryCodes(userId, recoveryCodes) {
        return await this.update(userId, {
            two_factor_recovery_codes: recoveryCodes,
        });
    }
    static async findByPublicUsername(username) {
        // Case-insensitive username lookup
        const result = await pool.query('SELECT * FROM users WHERE LOWER(public_username) = LOWER($1) AND public_username IS NOT NULL', [username]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptUserData(result.rows[0]);
    }
    static async findByInboundHandle(handle) {
        const result = await pool.query('SELECT * FROM users WHERE LOWER(inbound_email_handle) = LOWER($1) AND inbound_email_handle IS NOT NULL', [handle]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptUserData(result.rows[0]);
    }
    static async findByReferralCode(code) {
        // Case-insensitive referral code lookup
        const result = await pool.query('SELECT * FROM users WHERE LOWER(referral_code) = LOWER($1) AND referral_code IS NOT NULL', [code]);
        if (!result.rows[0]) {
            return null;
        }
        return this.decryptUserData(result.rows[0]);
    }
    static async findByUsernameOrEmail(usernameOrEmail) {
        // Try username first (case-insensitive)
        const byUsername = await this.findByPublicUsername(usernameOrEmail);
        if (byUsername) {
            return byUsername;
        }
        // Try email (case-insensitive) - findByEmail now handles encryption
        const byEmail = await this.findByEmail(usernameOrEmail);
        if (byEmail) {
            return byEmail;
        }
        // Try as @injest.io email format
        if (usernameOrEmail.includes('@injest.io')) {
            const handle = usernameOrEmail.split('@')[0];
            const byHandle = await this.findByInboundHandle(handle);
            if (byHandle) {
                return byHandle;
            }
        }
        return null;
    }
    static async setPassword(userId, passwordHash) {
        return await this.update(userId, {
            password_hash: passwordHash,
        });
    }
    static async isProfilePrivate(userId) {
        const result = await pool.query('SELECT profile_private FROM users WHERE id = $1', [userId]);
        return result.rows[0]?.profile_private === true;
    }
    static async updateProfile(userId, profileData) {
        return await this.update(userId, profileData);
    }
}
//# sourceMappingURL=User.js.map