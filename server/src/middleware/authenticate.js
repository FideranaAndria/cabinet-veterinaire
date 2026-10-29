import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { HttpError } from '../utils/http-error.js';

export async function authenticate(request, _response, next) {
  try {
    const authorization = request.get('authorization');
    const match = authorization?.match(/^Bearer (.+)$/i);

    if (!match) {
      throw new HttpError(401, 'Authentification requise.');
    }

    let claims;
    try {
      claims = jwt.verify(match[1], env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new HttpError(401, 'Session invalide ou expirée.');
    }

    const [sessions] = await pool.execute(
      `SELECT users.id, users.email, users.first_name, users.last_name, user_sessions.id AS session_id
       FROM user_sessions
       JOIN users ON users.id = user_sessions.user_id
       WHERE user_sessions.id = ? AND user_sessions.user_id = ?
         AND user_sessions.revoked_at IS NULL
         AND user_sessions.expires_at > UNIX_TIMESTAMP()
         AND users.is_active = TRUE
       LIMIT 1`,
      [claims.sid, claims.sub],
    );

    if (sessions.length === 0) {
      throw new HttpError(401, 'Session invalide ou expirée.');
    }

    const [access] = await pool.execute(
      `SELECT roles.name AS role_name, permissions.permission_key
       FROM user_roles
       JOIN roles ON roles.id = user_roles.role_id
       LEFT JOIN role_permissions ON role_permissions.role_id = roles.id
       LEFT JOIN permissions ON permissions.id = role_permissions.permission_id
       WHERE user_roles.user_id = ?`,
      [claims.sub],
    );

    request.auth = {
      id: sessions[0].id,
      email: sessions[0].email,
      firstName: sessions[0].first_name,
      lastName: sessions[0].last_name,
      sessionId: sessions[0].session_id,
      roles: [...new Set(access.map((row) => row.role_name))],
      permissions: [...new Set(access.map((row) => row.permission_key).filter(Boolean))],
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(permission) {
  return (request, _response, next) => {
    if (!request.auth?.permissions.includes(permission)) {
      next(new HttpError(403, 'Vous n’avez pas les droits nécessaires.'));
      return;
    }

    next();
  };
}