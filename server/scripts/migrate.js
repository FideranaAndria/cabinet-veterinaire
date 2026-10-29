import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const files = (await readdir(migrationsDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const connection = await pool.getConnection();

try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(190) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  for (const filename of files) {
    const [applied] = await connection.execute('SELECT filename FROM schema_migrations WHERE filename = ?', [filename]);
    if (applied.length > 0) continue;

    const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');

    if (filename.startsWith('001_')) {
      const expectedTables = [...sql.matchAll(/CREATE TABLE\s+([a-z0-9_]+)/gi)].map((match) => match[1]);
      const [existingRows] = await connection.execute(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
        [env.DB_NAME],
      );
      const existingTables = new Set(existingRows.map((row) => row.TABLE_NAME.toLowerCase()));
      const presentCount = expectedTables.filter((table) => existingTables.has(table.toLowerCase())).length;

      if (presentCount === expectedTables.length) {
        await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
        console.info(`Migration ${filename} déjà présente, marquée comme appliquée.`);
        continue;
      }

      if (presentCount > 0) {
        const missing = expectedTables.filter((table) => !existingTables.has(table.toLowerCase()));
        throw new Error(`Schéma initial partiel. Tables manquantes: ${missing.join(', ')}. Vérifiez la base avant toute migration.`);
      }
    }

    const statements = sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await connection.query(statement);
    await connection.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
    console.info(`Migration ${filename} appliquée.`);
  }
} finally {
  connection.release();
  await pool.end();
}