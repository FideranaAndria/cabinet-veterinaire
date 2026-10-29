import { randomBytes } from 'node:crypto';
import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const clientFields = [
  'first_name', 'last_name', 'date_of_birth', 'sex', 'email', 'phone', 'address_line',
  'postal_code', 'city', 'payment_method', 'preferred_contact', 'consent_personal_data',
  'consent_marketing', 'notes',
];

function clientNumber(id) {
  return `CL-${String(id).padStart(8, '0')}`;
}

export async function listClients(request, response) {
  const { search, page, pageSize } = request.query;
  const offset = (page - 1) * pageSize;
  const searchPattern = `%${search}%`;
  const filter = search
    ? 'AND (client_number LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)'
    : '';
  const values = search ? [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern] : [];
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM clients WHERE deleted_at IS NULL ${filter}`, values);
  const [clients] = await pool.execute(
    `SELECT id, client_number, first_name, last_name, email, phone, city, status, created_at
     FROM clients WHERE deleted_at IS NULL ${filter}
     ORDER BY last_name, first_name LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );

  response.json({
    success: true,
    data: clients,
    pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) },
  });
}

async function findClient(id) {
  const [rows] = await pool.execute(
    `SELECT id, client_number, first_name, last_name, date_of_birth, sex, email, phone,
            address_line, postal_code, city, payment_method, preferred_contact,
            consent_personal_data, consent_marketing, notes, status, created_at, updated_at
     FROM clients WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return rows[0];
}

export async function getClient(request, response) {
  const client = await findClient(request.params.id);
  if (!client) throw new HttpError(404, 'Client introuvable.');

  const [animals] = await pool.execute(
    `SELECT animals.id, animals.name, animals.species, animals.breed, animals.sex,
            animals.microchip_number, client_animal.relationship_type
     FROM client_animal
     JOIN animals ON animals.id = client_animal.animal_id
     WHERE client_animal.client_id = ? AND client_animal.valid_to IS NULL
       AND animals.deleted_at IS NULL
     ORDER BY animals.name`,
    [client.id],
  );
  response.json({ success: true, data: { ...client, animals } });
}

export async function createClient(request, response) {
  const fields = Object.keys(request.body);
  const values = fields.map((field) => request.body[field]);
  const placeholders = fields.map(() => '?').join(', ');
  const [result] = await pool.execute(
    `INSERT INTO clients (${fields.join(', ')}, created_by) VALUES (${placeholders}, ?)`,
    [...values, request.auth.id],
  );
  await pool.execute('UPDATE clients SET client_number = ? WHERE id = ?', [clientNumber(result.insertId), result.insertId]);

  response.status(201).json({ success: true, data: await findClient(result.insertId) });
}

export async function updateClient(request, response) {
  const { id } = request.params;
  if (!await findClient(id)) throw new HttpError(404, 'Client introuvable.');

  const fields = Object.keys(request.body).filter((field) => clientFields.includes(field));
  await pool.execute(
    `UPDATE clients SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    [...fields.map((field) => request.body[field]), id],
  );
  response.json({ success: true, data: await findClient(id) });
}

export async function archiveClient(request, response) {
  const [result] = await pool.execute(
    `UPDATE clients SET status = 'archived', deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [request.auth.id, request.params.id],
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Client introuvable.');
  response.json({ success: true, message: 'Dossier client archivé.' });
}