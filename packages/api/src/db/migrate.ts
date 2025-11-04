import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runMigrations() {
  try {
    const { stdout, stderr } = await execAsync('npx drizzle-kit push');
    console.log(stdout);
    if (stderr) {
      console.error(stderr);
    }
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
