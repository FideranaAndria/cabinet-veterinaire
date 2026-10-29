import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

async function getAccess(userId) {
  const [rows] = await pool.execute(
    `SELECT roles.name AS role_name, permissions.permission_key
     FROM user_roles
     JOIN roles ON roles.id = user_roles.role_id
     LEFT JOIN role_permissions ON role_permissions.role_id = roles.id
     LEFT JOIN permissions ON permissions.id = role_permissions.permission_id
     WHERE user_roles.user_id = ?`,
    [userId],
  );

  return {
    roles: [...new Set(rows.map((row) => row.role_name))],
    permissions: [...new Set(rows.map((row) => row.permission_key).filter(Boolean))],
  };
}

function presentUser(user, access) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    ...access,
  };
}

export async function login(request, response) {
   

 console.log('=== LOGIN ===');
  console.log('body:', JSON.stringify(request.body));
  console.log('==============');

  
  const [users] = await pool.execute(
    'SELECT id, email, password_hash, first_name, last_name, is_active FROM users WHERE email = ? LIMIT 1',
    [request.body.email],
  );
  const user = users[0];
  const validPassword = user && await bcrypt.compare(request.body.password, user.password_hash);

  if (!user || !user.is_active || !validPassword) {
    throw new HttpError(401, 'Adresse e-mail ou mot de passe invalide.');
  }

  const sessionId = randomUUID();
  const accessToken = jwt.sign(
    { sub: String(user.id), sid: sessionId },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_TTL },
  );
  const { exp } = jwt.decode(accessToken);

  await pool.execute(
    'INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    [sessionId, user.id, exp],
  );
  await pool.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

  response.json({
    success: true,
    data: { accessToken, user: presentUser(user, await getAccess(user.id)) },
  });
}

export async function logout(request, response) {
  await pool.execute(
    'UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [request.auth.sessionId, request.auth.id],
  );
  response.json({ success: true, message: 'Session fermée.' });
}

export async function changePassword(request, response) {
  const [users] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [request.auth.id]);
  const user = users[0];
  const currentPasswordMatches = user && await bcrypt.compare(request.body.currentPassword, user.password_hash);

  if (!currentPasswordMatches) {
    throw new HttpError(400, 'Le mot de passe actuel est incorrect.');
  }

  if (await bcrypt.compare(request.body.newPassword, user.password_hash)) {
    throw new HttpError(400, 'Choisissez un mot de passe différent de l’actuel.');
  }

  const passwordHash = await bcrypt.hash(request.body.newPassword, env.BCRYPT_ROUNDS);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, request.auth.id]);
    await connection.execute(
      'UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
      [request.auth.id],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  response.json({ success: true, message: 'Mot de passe modifié. Reconnectez-vous.' });
}