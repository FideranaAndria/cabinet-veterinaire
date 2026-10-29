import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

export async function listLaboratoryRequests(request, response) {
  const { animal_id: animalId, client_id: clientId, status, page, pageSize } = request.query;
  const conditions = [];
  const values = [];
  if (animalId) { conditions.push('laboratory_requests.animal_id = ?'); values.push(animalId); }
  if (clientId) { conditions.push('laboratory_requests.client_id = ?'); values.push(clientId); }
  if (status) { conditions.push('laboratory_requests.status = ?'); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM laboratory_requests ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT laboratory_requests.id, laboratory_requests.client_id, laboratory_requests.animal_id,
            laboratory_requests.consultation_id, laboratory_requests.veterinarian_id,
            laboratory_requests.analysis_type, laboratory_requests.laboratory_name,
            laboratory_requests.requested_at, laboratory_requests.status, laboratory_requests.result,
            laboratory_requests.document_reference, laboratory_requests.completed_at,
            animals.name AS animal_name, clients.first_name AS client_first_name, clients.last_name AS client_last_name
     FROM laboratory_requests JOIN animals ON animals.id = laboratory_requests.animal_id
     JOIN clients ON clients.id = laboratory_requests.client_id ${where}
     ORDER BY laboratory_requests.requested_at DESC, laboratory_requests.id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: counts[0].total, totalPages: Math.ceil(counts[0].total / pageSize) } });
}

export async function createLaboratoryRequest(request, response) {
  const body = request.body;
  const [owners] = await pool.execute(
    `SELECT client_animal.id FROM client_animal
     JOIN animals ON animals.id = client_animal.animal_id
     JOIN clients ON clients.id = client_animal.client_id
     WHERE client_animal.animal_id = ? AND client_animal.client_id = ?
       AND client_animal.valid_to IS NULL AND animals.deleted_at IS NULL AND clients.deleted_at IS NULL LIMIT 1`,
    [body.animal_id, body.client_id],
  );
  if (owners.length === 0) throw new HttpError(422, 'Ce client ne détient pas cet animal.');
  const [vets] = await pool.execute(
    `SELECT users.id FROM users JOIN user_roles ON user_roles.user_id = users.id
     JOIN roles ON roles.id = user_roles.role_id
     WHERE users.id = ? AND users.is_active = TRUE AND roles.name = 'VETERINAIRE' LIMIT 1`,
    [body.veterinarian_id],
  );
  if (vets.length === 0) throw new HttpError(422, 'Le vétérinaire sélectionné est introuvable ou inactif.');
  if (body.consultation_id) {
    const [consultations] = await pool.execute(
      'SELECT id FROM consultations WHERE id = ? AND animal_id = ? AND client_id = ? LIMIT 1',
      [body.consultation_id, body.animal_id, body.client_id],
    );
    if (consultations.length === 0) throw new HttpError(422, 'La consultation ne correspond pas au dossier sélectionné.');
  }
  const requestedAt = body.requested_at ? new Date(body.requested_at) : new Date();
  const [result] = await pool.execute(
    `INSERT INTO laboratory_requests
     (client_id, animal_id, consultation_id, veterinarian_id, analysis_type, laboratory_name, requested_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.client_id, body.animal_id, body.consultation_id ?? null, body.veterinarian_id,
      body.analysis_type, body.laboratory_name ?? null, requestedAt, request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, ...body, status: 'PENDING' } });
}

export async function updateLaboratoryRequest(request, response) {
  const { id } = request.params;
  const [rows] = await pool.execute('SELECT status FROM laboratory_requests WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) throw new HttpError(404, 'Demande d’analyse introuvable.');
  const current = rows[0].status;
  const next = request.body.status ?? current;
  const transitions = {
    PENDING: ['PENDING', 'IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    COMPLETED: ['COMPLETED'],
    CANCELLED: ['CANCELLED'],
  };
  if (!transitions[current]?.includes(next)) throw new HttpError(409, 'Cette transition de statut est interdite.');
  const fields = Object.keys(request.body);
  const values = fields.map((field) => request.body[field] ?? null);
  const assignments = fields.map((field) => `${field} = ?`);
  assignments.push("completed_at = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) WHEN ? <> 'COMPLETED' THEN NULL ELSE completed_at END");
  values.push(next, next, id);
  await pool.execute(`UPDATE laboratory_requests SET ${assignments.join(', ')} WHERE id = ?`, values);
  response.json({ success: true, data: { id: Number(id), ...request.body, status: next } });
}
