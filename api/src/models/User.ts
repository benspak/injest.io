import pool from '../config/database.js';
import type { SubscriptionTier } from '../utils/subscriptionPlans.js';

export interface User {
  id: string;
  email: string;
  verified: boolean;
  is_premium?: boolean;
  subscription_tier?: SubscriptionTier;
  stripe_customer_id?: string;
  bookmark_import_count?: number;
  last_bookmark_import_payment?: Date;
  api_key_hash?: string | null;
  api_key_created_at?: Date | null;
  api_key_last_used_at?: Date | null;
  two_factor_enabled?: boolean;
  two_factor_secret?: string | null;
  two_factor_confirmed_at?: Date | null;
  two_factor_recovery_codes?: string[] | null;
  public_username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  bio?: string | null;
  company?: string | null;
  project_title?: string | null;
  project_description?: string | null;
  zip_code?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  x_profile_url?: string | null;
  youtube_url?: string | null;
  github_url?: string | null;
  linkedin_url?: string | null;
  profile_private?: boolean;
  inbound_email_handle?: string | null;
  password_hash?: string | null;
  recovery_email?: string | null;
  date_of_birth?: Date | null;
  referral_code?: string | null;
  stripe_connect_account_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export class UserModel {
  static async findByEmail(email: string): Promise<User | null> {
    // Case-insensitive email lookup
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return result.rows[0] || null;
  }

  static async findById(id: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  static async create(email: string): Promise<User> {
    const result = await pool.query(
      'INSERT INTO users (email, verified) VALUES ($1, $2) RETURNING *',
      [email, false]
    );
    return result.rows[0];
  }

  static async createWithPassword(
    email: string,
    passwordHash: string,
    recoveryEmail: string,
    profileData: {
      public_username: string;
      first_name: string;
      last_name: string;
      date_of_birth?: Date | null;
      headline?: string;
      bio?: string;
      company?: string;
      project_title?: string;
      project_description?: string;
      zip_code?: string;
      x_profile_url?: string;
      youtube_url?: string;
      github_url?: string;
      linkedin_url?: string;
    }
  ): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (
        email, verified, password_hash, recovery_email,
        public_username, inbound_email_handle,
        first_name, last_name, date_of_birth, headline, bio, company,
        project_title, project_description, zip_code,
        x_profile_url, youtube_url, github_url, linkedin_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
      [
        email,
        true, // Auto-verify users created with password
        passwordHash,
        recoveryEmail,
        profileData.public_username,
        profileData.public_username, // inbound_email_handle = public_username
        profileData.first_name,
        profileData.last_name,
        profileData.date_of_birth || null,
        profileData.headline || null,
        profileData.bio || null,
        profileData.company || null,
        profileData.project_title || null,
        profileData.project_description || null,
        profileData.zip_code || null,
        profileData.x_profile_url || null,
        profileData.youtube_url || null,
        profileData.github_url || null,
        profileData.linkedin_url || null,
      ]
    );
    return result.rows[0];
  }

  static async verifyEmail(id: string): Promise<User> {
    const result = await pool.query(
      'UPDATE users SET verified = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  static async update(id: string, updates: Partial<User>): Promise<User> {
    const fields: string[] = [];
    const values: any[] = [];
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
    if (updates.password_hash !== undefined) {
      fields.push(`password_hash = $${paramCount++}`);
      values.push(updates.password_hash);
    }
    if (updates.recovery_email !== undefined) {
      fields.push(`recovery_email = $${paramCount++}`);
      values.push(updates.recovery_email);
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
      return await this.findById(id) as User;
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async setApiKey(userId: string, apiKeyHash: string): Promise<User> {
    return await this.update(userId, {
      api_key_hash: apiKeyHash,
      api_key_created_at: new Date(),
      api_key_last_used_at: null,
    });
  }

  static async clearApiKey(userId: string): Promise<User> {
    return await this.update(userId, {
      api_key_hash: null,
      api_key_created_at: null,
      api_key_last_used_at: null,
    });
  }

  static async updateApiKeyLastUsed(userId: string): Promise<void> {
    await pool.query('UPDATE users SET api_key_last_used_at = NOW() WHERE id = $1', [userId]);
  }

  static async findByApiKeyHash(apiKeyHash: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE api_key_hash = $1 AND api_key_hash IS NOT NULL',
      [apiKeyHash]
    );
    return result.rows[0] || null;
  }

  static async saveTwoFactorSecret(userId: string, secret: string | null): Promise<User> {
    return await this.update(userId, {
      two_factor_secret: secret,
      two_factor_enabled: false,
      two_factor_confirmed_at: null,
      two_factor_recovery_codes: null,
    });
  }

  static async enableTwoFactor(userId: string, secret: string, recoveryCodes: string[]): Promise<User> {
    return await this.update(userId, {
      two_factor_secret: secret,
      two_factor_enabled: true,
      two_factor_confirmed_at: new Date(),
      two_factor_recovery_codes: recoveryCodes,
    });
  }

  static async disableTwoFactor(userId: string): Promise<User> {
    return await this.update(userId, {
      two_factor_secret: null,
      two_factor_enabled: false,
      two_factor_confirmed_at: null,
      two_factor_recovery_codes: null,
    });
  }

  static async updateRecoveryCodes(userId: string, recoveryCodes: string[] | null): Promise<User> {
    return await this.update(userId, {
      two_factor_recovery_codes: recoveryCodes,
    });
  }

  static async findByPublicUsername(username: string): Promise<User | null> {
    // Case-insensitive username lookup
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(public_username) = LOWER($1) AND public_username IS NOT NULL',
      [username]
    );
    return result.rows[0] || null;
  }

  static async findByInboundHandle(handle: string): Promise<User | null> {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(inbound_email_handle) = LOWER($1) AND inbound_email_handle IS NOT NULL',
      [handle]
    );
    return result.rows[0] || null;
  }

  static async findByReferralCode(code: string): Promise<User | null> {
    // Case-insensitive referral code lookup
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(referral_code) = LOWER($1) AND referral_code IS NOT NULL',
      [code]
    );
    return result.rows[0] || null;
  }

  static async findByUsernameOrEmail(usernameOrEmail: string): Promise<User | null> {
    // Try username first (case-insensitive)
    const byUsername = await this.findByPublicUsername(usernameOrEmail);
    if (byUsername) {
      return byUsername;
    }

    // Try email (case-insensitive)
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

  static async setPassword(userId: string, passwordHash: string): Promise<User> {
    return await this.update(userId, {
      password_hash: passwordHash,
    });
  }


  static async isProfilePrivate(userId: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT profile_private FROM users WHERE id = $1',
      [userId]
    );
    return result.rows[0]?.profile_private === true;
  }

  static async updateProfile(userId: string, profileData: Partial<User>): Promise<User> {
    return await this.update(userId, profileData);
  }
}
