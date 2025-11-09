import pool from '../config/database.js';

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: tsx src/scripts/tmpInspectAttachments.ts <item-id>');
    process.exit(1);
  }

  const { rows } = await pool.query('SELECT attachments FROM items WHERE id = $1', [id]);
  console.log(JSON.stringify(rows[0]?.attachments, null, 2));
  await pool.end();
}

void main();
