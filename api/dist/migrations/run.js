import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function runMigrations() {
    try {
        const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Run migrations in order
        console.log(`Found ${files.length} migration files`);
        for (const file of files) {
            console.log(`Running migration: ${file}`);
            const migrationFile = path.join(migrationsDir, file);
            const sql = fs.readFileSync(migrationFile, 'utf-8');
            // Split SQL into statements, properly handling dollar-quoted strings
            const statements = [];
            let currentStatement = '';
            let inDollarQuote = false;
            let dollarTag = '';
            let i = 0;
            while (i < sql.length) {
                const char = sql[i];
                // Check for dollar quote start
                if (char === '$' && !inDollarQuote) {
                    // Look for opening dollar quote tag (e.g., $$ or $tag$)
                    let j = i + 1;
                    let tag = '';
                    while (j < sql.length && sql[j] !== '$') {
                        tag += sql[j];
                        j++;
                    }
                    if (j < sql.length && sql[j] === '$') {
                        // Found opening dollar quote
                        dollarTag = '$' + tag + '$';
                        inDollarQuote = true;
                        currentStatement += dollarTag;
                        i = j + 1; // Skip past the closing $
                        continue;
                    }
                }
                // Check for dollar quote end
                else if (char === '$' && inDollarQuote) {
                    // Check if this matches the closing tag
                    // Read characters to match the dollarTag length
                    let matchLength = dollarTag.length - 1; // -1 because we already have the first $
                    let potentialClose = '$';
                    let j = i + 1;
                    let charsRead = 0;
                    while (charsRead < matchLength && j < sql.length) {
                        potentialClose += sql[j];
                        j++;
                        charsRead++;
                    }
                    if (potentialClose === dollarTag) {
                        // Found closing dollar quote
                        inDollarQuote = false;
                        currentStatement += dollarTag;
                        i = j; // Skip past the closing tag
                        dollarTag = '';
                        continue;
                    }
                }
                currentStatement += char;
                // If we're not in a dollar quote and hit a semicolon, end the statement
                if (!inDollarQuote && char === ';') {
                    const trimmed = currentStatement.trim();
                    if (trimmed.length > 0) {
                        statements.push(trimmed);
                    }
                    currentStatement = '';
                }
                i++;
            }
            // Add any remaining statement
            const trimmed = currentStatement.trim();
            if (trimmed.length > 0) {
                statements.push(trimmed);
            }
            // Execute statements
            for (const statement of statements) {
                if (statement) {
                    await pool.query(statement);
                }
            }
        }
        console.log('All migrations completed successfully');
        process.exit(0);
    }
    catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}
runMigrations();
//# sourceMappingURL=run.js.map