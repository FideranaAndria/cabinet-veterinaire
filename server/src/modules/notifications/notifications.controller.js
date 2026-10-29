import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

export async function listNotifications(request, response) {
  const { unread_only: unreadOnly, page, pageSize } = request.query;
  const userId = request.auth.id;
  const condition = unreadOnly === 'true' ? 'AND read_at IS NULL' : '';
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? ${condition}`,
    [userId],
  );
  const [unreadRows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
  const [rows] = await pool.execute(
    `SELECT id, type, title, message, entity_type, entity_id, read_at, created_at
     FROM notifications WHERE user_id = ? ${condition}
     ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [userId, pageSize, offset],
  );
  response.json({
    success: true,
    data: rows,
    unread_count: unreadRows[0].total,
    pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) },
  });
}

export async function markNotificationRead(request, response) {
  const [result] = await pool.execute(
    'UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?',
    [request.params.id, request.auth.id],
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.execute('SELECT id FROM notifications WHERE id = ? AND user_id = ?', [request.params.id, request.auth.id]);
    if (rows.length === 0) throw new HttpError(404, 'Notification introuvable.');
  }
  response.json({ success: true, data: { id: Number(request.params.id), read: true } });
}

export async function markAllNotificationsRead(request, response) {
  const [result] = await pool.execute(
    'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL',
    [request.auth.id],
  );
  response.json({ success: true, data: { updated: result.affectedRows } });
}
