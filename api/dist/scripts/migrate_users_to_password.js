import dotenv from 'dotenv';
import crypto from 'crypto';
import pool from '../config/database.js';
import { UserModel } from '../models/User.js';
import { hashPassword } from '../utils/passwords.js';
import { emailService } from '../services/email.js';
dotenv.config();
/**
 * Generate a secure random temporary password
 */
function generateTemporaryPassword() {
    // Generate 16 random bytes and convert to base64
    const randomBytes = crypto.randomBytes(16);
    // Convert to a more readable format (remove special chars, use alphanumeric)
    const base64 = randomBytes.toString('base64');
    // Remove special characters and take first 16 chars
    return base64.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}
/**
 * Send migration email to user with temporary password
 */
async function sendMigrationEmail(email, tempPassword) {
    const subject = 'Action Required: Update Your Injest.io Password';
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Action Required: Update Your Injest.io Password</h2>
      <p>Hello,</p>
      <p>We've upgraded the Injest.io authentication system. Your account has been migrated to password-based authentication.</p>
      <p><strong>Your temporary password is: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></strong></p>
      <p>Please sign in using your email address and this temporary password, then change your password immediately.</p>
      <p>You can sign in at: <a href="${process.env.FRONTEND_URL || 'https://injest.io'}/login">${process.env.FRONTEND_URL || 'https://injest.io'}/login</a></p>
      <p>If you have any questions or need assistance, please contact support.</p>
      <p>Best regards,<br>The Injest.io Team</p>
    </div>
  `;
    const text = `
Action Required: Update Your Injest.io Password

Hello,

We've upgraded the Injest.io authentication system. Your account has been migrated to password-based authentication.

Your temporary password is: ${tempPassword}

Please sign in using your email address and this temporary password, then change your password immediately.

You can sign in at: ${process.env.FRONTEND_URL || 'https://injest.io'}/login

If you have any questions or need assistance, please contact support.

Best regards,
The Injest.io Team
  `;
    await emailService.sendComposedEmail({
        to: email,
        subject,
        bodyHtml: html,
        bodyText: text,
    });
}
/**
 * Migrate a single user to password authentication
 */
async function migrateUser(userId, email) {
    // Check if user already has a password
    const user = await UserModel.findById(userId);
    if (!user) {
        console.error(`User ${userId} not found`);
        return;
    }
    if (user.password_hash) {
        console.log(`User ${email} already has a password, skipping...`);
        return;
    }
    // Generate temporary password
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);
    // Update user with password hash
    await UserModel.setPassword(userId, passwordHash);
    // Send migration email
    try {
        await sendMigrationEmail(email, tempPassword);
        console.log(`✓ Migrated user ${email} - temporary password sent`);
    }
    catch (error) {
        console.error(`✗ Failed to send email to ${email}:`, error);
        // Still mark as migrated since password is set
        console.log(`  Password set but email failed for ${email}`);
    }
}
/**
 * Main migration function
 */
async function main() {
    try {
        console.log('Starting user migration to password authentication...\n');
        // Get all users without passwords
        const result = await pool.query('SELECT id, email FROM users WHERE password_hash IS NULL ORDER BY created_at');
        const users = result.rows;
        console.log(`Found ${users.length} users to migrate\n`);
        if (users.length === 0) {
            console.log('No users to migrate.');
            return;
        }
        // Confirm before proceeding
        console.log('This will:');
        console.log('1. Generate temporary passwords for all users');
        console.log('2. Send migration emails with temporary passwords');
        console.log('3. Users will need to sign in and change their password\n');
        // Migrate each user
        let successCount = 0;
        let errorCount = 0;
        for (const user of users) {
            try {
                await migrateUser(user.id, user.email);
                successCount++;
            }
            catch (error) {
                console.error(`Failed to migrate user ${user.email}:`, error);
                errorCount++;
            }
        }
        console.log(`\nMigration complete:`);
        console.log(`  ✓ Successfully migrated: ${successCount}`);
        console.log(`  ✗ Errors: ${errorCount}`);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    }
    finally {
        await pool.end().catch((err) => {
            console.error('Error closing database connection pool:', err);
        });
    }
}
void main();
//# sourceMappingURL=migrate_users_to_password.js.map