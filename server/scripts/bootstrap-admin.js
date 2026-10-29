import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const prompt = readline.createInterface({ input: stdin, output: stdout });

try {
  const email = (await prompt.question('Adresse e-mail du premier administrateur : ')).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('Adresse e-mail invalide.');
  }

  const firstName = (await prompt.question('Prénom : ')).trim();
  const lastName = (await prompt.question('Nom : ')).trim();
  if (!firstName || !lastName || firstName.length > 100 || lastName.length > 100) {
    throw new Error('Le prénom et le nom sont obligatoires (100 caractères maximum).');
  }

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
  if (existing.length > 0) throw new Error('Un compte avec cette adresse existe déjà.');

  const temporaryPassword = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, env.BCRYPT_ROUNDS);
  const connection = await pool.getConnection();
  let userId;
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
      [email, passwordHash, firstName, lastName],
    );
    userId = result.insertId;
    const [roles] = await connection.execute('SELECT id FROM roles WHERE name = ?', ['ADMIN']);
    if (roles.length === 0) throw new Error('Rôle ADMIN absent. Appliquez les migrations avant le bootstrap.');
    await connection.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roles[0].id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  console.log(`Compte administrateur créé pour ${email}.`);
  console.log(`Mot de passe temporaire (à conserver maintenant) : ${temporaryPassword}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  prompt.close();
  await pool.end();
}