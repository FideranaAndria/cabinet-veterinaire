import { pool } from '../db/pool.js';

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ignoredPaths = new Set(['/api/v1/auth/login', '/api/v1/auth/change-password']);

export function auditMutations(request, response, next) {
  if (!mutatingMethods.has(request.method) || ignoredPaths.has(request.path)) {
    next();
    return;
  }

  response.once('finish', () => {
    if (response.statusCode < 200 || response.statusCode >= 300 || !request.auth?.id) return;
    const path = request.path.replace(/^\/api\/v1\/?/, '');
    const segments = path.split('/').filter(Boolean);
    const entityType = (segments[0] || 'api').slice(0, 120);
    const entityId = request.params?.id ?? segments.find((segment) => /^\d+$/.test(segment)) ?? null;
    const details = JSON.stringify({ method: request.method, path: `/${path}`.slice(0, 500), status: response.statusCode });
    void pool.execute(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [request.auth.id, `${request.method} ${entityType}`.slice(0, 120), entityType, entityId, details, request.ip?.slice(0, 45) ?? null],
    ).catch((error) => console.error('Échec de l’écriture dans le journal d’audit.', error));
  });
  next();
}
