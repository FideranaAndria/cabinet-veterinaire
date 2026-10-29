import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

export async function listMessages(request, response) {
  const { folder, page, pageSize } = request.query;
  const userId = request.auth.id;
  const ownerColumn = folder === 'sent' ? 'sender_id' : 'recipient_id';
  const otherColumn = folder === 'sent' ? 'recipient_id' : 'sender_id';
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM messages WHERE ${ownerColumn} = ?`, [userId]);
  let unreadCount = 0;
  if (folder === 'inbox') {
    const [unread] = await pool.execute('SELECT COUNT(*) AS total FROM messages WHERE recipient_id = ? AND read_at IS NULL', [userId]);
    unreadCount = unread[0].total;
  }
  const [rows] = await pool.execute(
    `SELECT messages.id, messages.sender_id, messages.recipient_id, messages.subject, messages.content,
            messages.read_at, messages.created_at, other.first_name AS other_first_name, other.last_name AS other_last_name
     FROM messages JOIN users other ON other.id = messages.${otherColumn}
     WHERE messages.${ownerColumn} = ? ORDER BY messages.created_at DESC, messages.id DESC LIMIT ? OFFSET ?`,
    [userId, pageSize, offset],
  );
  response.json({ success: true, data: rows, unread_count: unreadCount, pagination: { page, pageSize, total: counts[0].total, totalPages: Math.ceil(counts[0].total / pageSize) } });
}

export async function sendMessage(request, response) {
  const { recipient_id: recipientId, subject, content } = request.body;
  if (Number(recipientId) === Number(request.auth.id)) throw new HttpError(422, 'Vous ne pouvez pas vous envoyer un message.');
  const [users] = await pool.execute('SELECT id FROM users WHERE id = ? AND is_active = TRUE LIMIT 1', [recipientId]);
  if (!users.length) throw new HttpError(422, 'Le destinataire est introuvable ou inactif.');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      'INSERT INTO messages (sender_id, recipient_id, subject, content) VALUES (?, ?, ?, ?)',
      [request.auth.id, recipientId, subject, content],
    );
    await connection.execute(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       VALUES (?, 'message.received', ?, ?, 'messages', ?)`,
      [recipientId, subject, `Nouveau message de ${request.auth.firstName} ${request.auth.lastName}.`, String(result.insertId)],
    );
    await connection.commit();
    response.status(201).json({ success: true, data: { id: result.insertId, recipient_id: recipientId, subject, content } });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function markMessageRead(request, response) {
  const [result] = await pool.execute(
    'UPDATE messages SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND recipient_id = ?',
    [request.params.id, request.auth.id],
  );
  if (!result.affectedRows) {
    const [rows] = await pool.execute('SELECT id FROM messages WHERE id = ? AND recipient_id = ?', [request.params.id, request.auth.id]);
    if (!rows.length) throw new HttpError(404, 'Message introuvable.');
  }
  response.json({ success: true, data: { id: Number(request.params.id), read: true } });
}
