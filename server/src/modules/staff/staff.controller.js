import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

export async function listStaffProfiles(request, response) {
  const { page, pageSize, staff_type: staffType } = request.query;
  const where = staffType ? 'WHERE staff_profiles.staff_type = ?' : '';
  const filters = staffType ? [staffType] : [];
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM staff_profiles ${where}`, filters);
  const [rows] = await pool.execute(
    `SELECT staff_profiles.id, staff_profiles.user_id, staff_profiles.staff_number, staff_profiles.staff_type,
            staff_profiles.specialty, staff_profiles.qualification, staff_profiles.phone, staff_profiles.hired_on,
            staff_profiles.status, staff_profiles.notes, users.email, users.first_name, users.last_name, users.is_active
     FROM staff_profiles JOIN users ON users.id = staff_profiles.user_id ${where}
     ORDER BY users.last_name, users.first_name LIMIT ? OFFSET ?`, [...filters, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: counts[0].total, totalPages: Math.ceil(counts[0].total / pageSize) } });
}

export async function createStaffProfile(request, response) {
  const body = request.body;
  const [users] = await pool.execute('SELECT id, is_active FROM users WHERE id = ? LIMIT 1', [body.user_id]);
  if (!users.length) throw new HttpError(422, 'Utilisateur introuvable.');
  const [roles] = await pool.execute(
    `SELECT roles.name FROM user_roles JOIN roles ON roles.id = user_roles.role_id WHERE user_roles.user_id = ?`,
    [body.user_id],
  );
  const requiredRoles = {
    VETERINARIAN: ['VETERINAIRE'], VET_ASSISTANT: ['VETERINAIRE_ASSISTANT'], ASV: ['ASV'],
    ADMINISTRATIVE: ['ASSISTANT_ADMINISTRATIF', 'DIRECTION', 'ADMIN'], LABORATORY: ['LABORATOIRE'],
  };
  if (!roles.some((role) => requiredRoles[body.staff_type].includes(role.name))) {
    throw new HttpError(422, 'Le rôle de l’utilisateur ne correspond pas au type de personnel.');
  }
  const fields = Object.keys(body);
  const [result] = await pool.execute(
    `INSERT INTO staff_profiles (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
    fields.map((field) => body[field] ?? null),
  );
  response.status(201).json({ success: true, data: { id: result.insertId, ...body } });
}

export async function updateStaffProfile(request, response) {
  const fields = Object.keys(request.body);
  const [result] = await pool.execute(
    `UPDATE staff_profiles SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
    [...fields.map((field) => request.body[field] ?? null), request.params.id],
  );
  if (!result.affectedRows) throw new HttpError(404, 'Profil du personnel introuvable.');
  response.json({ success: true, data: { id: Number(request.params.id), ...request.body } });
}
