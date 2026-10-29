import { pool } from '../../db/pool.js';

export async function listAuditLogs(request, response) {
  const { entity_type: entityType, user_id: userId, from, to, page, pageSize } = request.query;
  const conditions = [];
  const values = [];
  if (entityType) { conditions.push('audit_logs.entity_type = ?'); values.push(entityType); }
  if (userId) { conditions.push('audit_logs.user_id = ?'); values.push(userId); }
  if (from) { conditions.push('audit_logs.created_at >= ?'); values.push(`${from} 00:00:00`); }
  if (to) { conditions.push('audit_logs.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT audit_logs.id, audit_logs.user_id, users.first_name, users.last_name,
            audit_logs.action, audit_logs.entity_type, audit_logs.entity_id,
            audit_logs.details, audit_logs.ip_address, audit_logs.created_at
     FROM audit_logs LEFT JOIN users ON users.id = audit_logs.user_id
     ${where} ORDER BY audit_logs.created_at DESC, audit_logs.id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({
    success: true,
    data: rows.map((row) => ({ ...row, details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details })),
    pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) },
  });
}
