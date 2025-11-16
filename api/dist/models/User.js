import pool from '../config/database.js';
export class UserModel {
    static async findByEmail(email) {
        // Case-insensitive email lookup
        const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        return result.rows[0] || null;
    }
    static async findById(id) {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0] || null;
    }
    static async create(email) {
        const result = await pool.query('INSERT INTO users (email, verified) VALUES ($1, $2) RETURNING *', [email, false]);
        return result.rows[0];
    }
    static async verifyEmail(id) {
        const result = await pool.query('UPDATE users SET verified = TRUE WHERE id = $1 RETURNING *', [id]);
        return result.rows[0];
    }
    static async update(id, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        if (updates.email !== undefined) {
            fields.push(`email = $${paramCount++}`);
            values.push(updates.email);
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
            values.push(updates.two_factor_secret);
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
            values.push(updates.first_name);
        }
        if (updates.last_name !== undefined) {
            fields.push(`last_name = $${paramCount++}`);
            values.push(updates.last_name);
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
            values.push(updates.zip_code);
        }
        if (updates.city !== undefined) {
            fields.push(`city = $${paramCount++}`);
            values.push(updates.city);
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
        if (fields.length === 0) {
            return await this.findById(id);
        }
        values.push(id);
        const result = await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`, values);
        return result.rows[0];
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
        return result.rows[0] || null;
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
        return result.rows[0] || null;
    }
    static async findByInboundHandle(handle) {
        const result = await pool.query('SELECT * FROM users WHERE LOWER(inbound_email_handle) = LOWER($1) AND inbound_email_handle IS NOT NULL', [handle]);
        return result.rows[0] || null;
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