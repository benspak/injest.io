import dotenv from 'dotenv';
import pool from '../config/database.js';
import { encrypt, encryptField } from '../utils/encryption.js';
import '../config/encryption.js'; // Validate encryption key on load
dotenv.config();
/**
 * Encrypt existing OAuth tokens
 */
async function encryptOAuthTokens() {
    const errors = [];
    let xcomCount = 0;
    let slackCount = 0;
    // Encrypt X.com OAuth tokens
    try {
        const xcomResult = await pool.query('SELECT id, access_token, refresh_token FROM xcom_oauth_tokens');
        for (const token of xcomResult.rows) {
            try {
                // Check if already encrypted (contains ':')
                if (token.access_token && !token.access_token.includes(':')) {
                    const encryptedAccess = encrypt(token.access_token);
                    const encryptedRefresh = token.refresh_token && !token.refresh_token.includes(':')
                        ? encrypt(token.refresh_token)
                        : token.refresh_token;
                    await pool.query('UPDATE xcom_oauth_tokens SET access_token = $1, refresh_token = $2 WHERE id = $3', [encryptedAccess, encryptedRefresh, token.id]);
                    xcomCount++;
                }
            }
            catch (error) {
                errors.push({
                    table: 'xcom_oauth_tokens',
                    id: token.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    catch (error) {
        console.error('Error encrypting X.com tokens:', error);
    }
    // Encrypt Slack OAuth tokens
    try {
        const slackResult = await pool.query('SELECT id, access_token, authed_user_token FROM slack_oauth_tokens');
        for (const token of slackResult.rows) {
            try {
                // Check if already encrypted
                if (token.access_token && !token.access_token.includes(':')) {
                    const encryptedAccess = encrypt(token.access_token);
                    const encryptedAuthed = token.authed_user_token && !token.authed_user_token.includes(':')
                        ? encrypt(token.authed_user_token)
                        : token.authed_user_token;
                    await pool.query('UPDATE slack_oauth_tokens SET access_token = $1, authed_user_token = $2 WHERE id = $3', [encryptedAccess, encryptedAuthed, token.id]);
                    slackCount++;
                }
            }
            catch (error) {
                errors.push({
                    table: 'slack_oauth_tokens',
                    id: token.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    catch (error) {
        console.error('Error encrypting Slack tokens:', error);
    }
    return { xcom: xcomCount, slack: slackCount, errors };
}
/**
 * Encrypt existing user PII and 2FA secrets
 */
async function encryptUsers() {
    const errors = [];
    let count = 0;
    try {
        const result = await pool.query(`
      SELECT id, email, recovery_email, first_name, last_name, zip_code, city, two_factor_secret
      FROM users
    `);
        for (const user of result.rows) {
            try {
                const updates = [];
                const values = [];
                let paramCount = 1;
                // Encrypt email (deterministic)
                if (user.email && !user.email.includes(':')) {
                    updates.push(`email = $${paramCount++}`);
                    values.push(encryptField(user.email.toLowerCase(), true));
                }
                // Encrypt recovery_email (deterministic)
                if (user.recovery_email && !user.recovery_email.includes(':')) {
                    updates.push(`recovery_email = $${paramCount++}`);
                    values.push(encryptField(user.recovery_email.toLowerCase(), true));
                }
                // Encrypt first_name (opaque)
                if (user.first_name && !user.first_name.includes(':')) {
                    updates.push(`first_name = $${paramCount++}`);
                    values.push(encryptField(user.first_name));
                }
                // Encrypt last_name (opaque)
                if (user.last_name && !user.last_name.includes(':')) {
                    updates.push(`last_name = $${paramCount++}`);
                    values.push(encryptField(user.last_name));
                }
                // Encrypt zip_code (opaque)
                if (user.zip_code && !user.zip_code.includes(':')) {
                    updates.push(`zip_code = $${paramCount++}`);
                    values.push(encryptField(user.zip_code));
                }
                // Encrypt city (opaque)
                if (user.city && !user.city.includes(':')) {
                    updates.push(`city = $${paramCount++}`);
                    values.push(encryptField(user.city));
                }
                // Encrypt two_factor_secret (opaque)
                if (user.two_factor_secret && !user.two_factor_secret.includes(':')) {
                    updates.push(`two_factor_secret = $${paramCount++}`);
                    values.push(encryptField(user.two_factor_secret));
                }
                if (updates.length > 0) {
                    values.push(user.id);
                    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);
                    count++;
                }
            }
            catch (error) {
                errors.push({
                    table: 'users',
                    id: user.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    catch (error) {
        console.error('Error encrypting users:', error);
    }
    return { count, errors };
}
/**
 * Encrypt existing contacts
 */
async function encryptContacts() {
    const errors = [];
    let count = 0;
    try {
        const result = await pool.query(`
      SELECT id, first_name, last_name, email, phone
      FROM contacts
    `);
        for (const contact of result.rows) {
            try {
                const updates = [];
                const values = [];
                let paramCount = 1;
                // Encrypt first_name (opaque)
                if (contact.first_name && !contact.first_name.includes(':')) {
                    updates.push(`first_name = $${paramCount++}`);
                    values.push(encryptField(contact.first_name));
                }
                // Encrypt last_name (opaque)
                if (contact.last_name && !contact.last_name.includes(':')) {
                    updates.push(`last_name = $${paramCount++}`);
                    values.push(encryptField(contact.last_name));
                }
                // Encrypt email (deterministic)
                if (contact.email && !contact.email.includes(':')) {
                    updates.push(`email = $${paramCount++}`);
                    values.push(encryptField(contact.email.toLowerCase(), true));
                }
                // Encrypt phone (deterministic)
                if (contact.phone && !contact.phone.includes(':')) {
                    updates.push(`phone = $${paramCount++}`);
                    values.push(encryptField(contact.phone, true));
                }
                if (updates.length > 0) {
                    values.push(contact.id);
                    await pool.query(`UPDATE contacts SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);
                    count++;
                }
            }
            catch (error) {
                errors.push({
                    table: 'contacts',
                    id: contact.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    catch (error) {
        console.error('Error encrypting contacts:', error);
    }
    return { count, errors };
}
/**
 * Encrypt existing items
 */
async function encryptItems() {
    const errors = [];
    let count = 0;
    try {
        // Process in batches to avoid memory issues
        const batchSize = 100;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
            const result = await pool.query(`
        SELECT id, raw, title, description, notes, clean
        FROM items
        WHERE deleted_at IS NULL
        ORDER BY id
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);
            if (result.rows.length === 0) {
                hasMore = false;
                break;
            }
            for (const item of result.rows) {
                try {
                    const updates = [];
                    const values = [];
                    let paramCount = 1;
                    // Encrypt raw (opaque)
                    if (item.raw && !item.raw.includes(':')) {
                        updates.push(`raw = $${paramCount++}`);
                        values.push(encryptField(item.raw));
                    }
                    // Encrypt title (deterministic)
                    if (item.title && !item.title.includes(':')) {
                        updates.push(`title = $${paramCount++}`);
                        values.push(encryptField(item.title, true));
                    }
                    // Encrypt description (opaque)
                    if (item.description && !item.description.includes(':')) {
                        updates.push(`description = $${paramCount++}`);
                        values.push(encryptField(item.description));
                    }
                    // Encrypt notes (opaque)
                    if (item.notes && !item.notes.includes(':')) {
                        updates.push(`notes = $${paramCount++}`);
                        values.push(encryptField(item.notes));
                    }
                    // Encrypt clean (opaque)
                    if (item.clean && !item.clean.includes(':')) {
                        updates.push(`clean = $${paramCount++}`);
                        values.push(encryptField(item.clean));
                    }
                    if (updates.length > 0) {
                        values.push(item.id);
                        await pool.query(`UPDATE items SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);
                        count++;
                    }
                }
                catch (error) {
                    errors.push({
                        table: 'items',
                        id: item.id,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            offset += batchSize;
            if (result.rows.length < batchSize) {
                hasMore = false;
            }
            console.log(`Processed ${offset} items...`);
        }
    }
    catch (error) {
        console.error('Error encrypting items:', error);
    }
    return { count, errors };
}
/**
 * Encrypt existing search documents
 */
async function encryptSearchDocuments() {
    const errors = [];
    let count = 0;
    try {
        const result = await pool.query(`
      SELECT id, title, content, summary
      FROM search_documents
    `);
        for (const doc of result.rows) {
            try {
                const updates = [];
                const values = [];
                let paramCount = 1;
                // Encrypt title (deterministic)
                if (doc.title && !doc.title.includes(':')) {
                    updates.push(`title = $${paramCount++}`);
                    values.push(encryptField(doc.title, true));
                }
                // Encrypt content (opaque)
                if (doc.content && !doc.content.includes(':')) {
                    updates.push(`content = $${paramCount++}`);
                    values.push(encryptField(doc.content));
                }
                // Encrypt summary (opaque)
                if (doc.summary && !doc.summary.includes(':')) {
                    updates.push(`summary = $${paramCount++}`);
                    values.push(encryptField(doc.summary));
                }
                if (updates.length > 0) {
                    values.push(doc.id);
                    await pool.query(`UPDATE search_documents SET ${updates.join(', ')} WHERE id = $${paramCount}`, values);
                    count++;
                }
            }
            catch (error) {
                errors.push({
                    table: 'search_documents',
                    id: doc.id,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    catch (error) {
        console.error('Error encrypting search documents:', error);
    }
    return { count, errors };
}
/**
 * Main migration function
 */
async function runMigration() {
    console.log('Starting data encryption migration...\n');
    const stats = {
        oauthTokens: { xcom: 0, slack: 0 },
        users: 0,
        contacts: 0,
        items: 0,
        searchDocuments: 0,
        errors: [],
    };
    try {
        // Encrypt OAuth tokens
        console.log('Encrypting OAuth tokens...');
        const oauthResult = await encryptOAuthTokens();
        stats.oauthTokens = { xcom: oauthResult.xcom, slack: oauthResult.slack };
        stats.errors.push(...oauthResult.errors);
        console.log(`  ✓ X.com tokens: ${oauthResult.xcom}`);
        console.log(`  ✓ Slack tokens: ${oauthResult.slack}\n`);
        // Encrypt users
        console.log('Encrypting user data...');
        const userResult = await encryptUsers();
        stats.users = userResult.count;
        stats.errors.push(...userResult.errors);
        console.log(`  ✓ Users encrypted: ${userResult.count}\n`);
        // Encrypt contacts
        console.log('Encrypting contacts...');
        const contactResult = await encryptContacts();
        stats.contacts = contactResult.count;
        stats.errors.push(...contactResult.errors);
        console.log(`  ✓ Contacts encrypted: ${contactResult.count}\n`);
        // Encrypt items
        console.log('Encrypting items (this may take a while)...');
        const itemResult = await encryptItems();
        stats.items = itemResult.count;
        stats.errors.push(...itemResult.errors);
        console.log(`  ✓ Items encrypted: ${itemResult.count}\n`);
        // Encrypt search documents
        console.log('Encrypting search documents...');
        const docResult = await encryptSearchDocuments();
        stats.searchDocuments = docResult.count;
        stats.errors.push(...docResult.errors);
        console.log(`  ✓ Search documents encrypted: ${docResult.count}\n`);
        // Print summary
        console.log('Migration Summary:');
        console.log('==================');
        console.log(`OAuth Tokens - X.com: ${stats.oauthTokens.xcom}, Slack: ${stats.oauthTokens.slack}`);
        console.log(`Users: ${stats.users}`);
        console.log(`Contacts: ${stats.contacts}`);
        console.log(`Items: ${stats.items}`);
        console.log(`Search Documents: ${stats.searchDocuments}`);
        console.log(`Total Errors: ${stats.errors.length}`);
        if (stats.errors.length > 0) {
            console.log('\nErrors encountered:');
            stats.errors.slice(0, 10).forEach((err) => {
                console.log(`  - ${err.table} (${err.id}): ${err.error}`);
            });
            if (stats.errors.length > 10) {
                console.log(`  ... and ${stats.errors.length - 10} more errors`);
            }
        }
        console.log('\n✓ Migration completed!');
    }
    catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
    finally {
        await pool.end();
    }
}
// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runMigration()
        .then(() => {
        process.exit(0);
    })
        .catch((error) => {
        console.error('Migration error:', error);
        process.exit(1);
    });
}
export { runMigration };
//# sourceMappingURL=encrypt_existing_data.js.map