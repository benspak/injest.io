import dotenv from 'dotenv';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import pool from '../config/database.js';
import { UserModel } from '../models/User.js';
dotenv.config();
async function promptForEmail() {
    const providedEmail = process.argv[2];
    if (providedEmail) {
        return providedEmail.trim();
    }
    const rl = readline.createInterface({ input, output });
    try {
        const answer = await rl.question('Enter the email to upgrade to pro: ');
        return answer.trim();
    }
    finally {
        rl.close();
    }
}
async function upgradeUserToPro(email) {
    const normalizedEmail = email.toLowerCase();
    console.log(`Looking up user with email: ${normalizedEmail}`);
    const user = await UserModel.findByEmail(normalizedEmail);
    if (!user) {
        console.error('No user found with that email.');
        process.exitCode = 1;
        return;
    }
    if (user.subscription_tier === 'pro' || user.subscription_tier === 'pro_annual' || user.is_premium) {
        console.log('User is already marked as a paid user. Updating subscription tier to ensure it is set to pro.');
    }
    const targetTier = 'pro';
    const updatedUser = await UserModel.update(user.id, {
        is_premium: true,
        subscription_tier: targetTier,
    });
    console.log('✓ User upgraded successfully');
    console.log('User details:');
    console.log({
        id: updatedUser.id,
        email: updatedUser.email,
        subscription_tier: updatedUser.subscription_tier,
        is_premium: updatedUser.is_premium,
    });
}
async function main() {
    try {
        const email = await promptForEmail();
        if (!email) {
            console.error('Email is required.');
            process.exitCode = 1;
            return;
        }
        await upgradeUserToPro(email);
    }
    catch (error) {
        console.error('Failed to upgrade user:', error);
        process.exitCode = 1;
    }
    finally {
        await pool.end().catch((err) => {
            console.error('Error closing database connection pool:', err);
        });
    }
}
void main();
//# sourceMappingURL=makePlusUser.js.map