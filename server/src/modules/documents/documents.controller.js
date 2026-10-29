import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

export async function listDocuments(request, response) {
  const { client_id: clientId, animal_id: animalId, category, page, pageSize } = request.query;
  const conditions = [];
  const values = [];
  if (clientId) { conditions.push('documents.client_id = ?'); values.push(clientId); }
  if (animalId) { conditions.push('documents.animal_id = ?'); values.push(animalId); }
  if (category) { conditions.push('documents.category = ?'); values.push(category); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [counts] = await pool.execute(`SELECT COUNT(*) AS total FROM documents ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT id, client_id, animal_id, consultation_id, hospitalization_id, category,
            file_name, storage_key, mime_type, size_bytes, description, uploaded_by, created_at
     FROM documents ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: counts[0].total, totalPages: Math.ceil(counts[0].total / pageSize) } });
}

export async function createDocument(request, response) {
  const body = request.body;
  if (body.animal_id && body.client_id) {
    const [owners] = await pool.execute(
      'SELECT id FROM client_animal WHERE animal_id = ? AND client_id = ? AND valid_to IS NULL LIMIT 1',
      [body.animal_id, body.client_id],
    );
    if (!owners.length) throw new HttpError(422, 'Le client ne détient pas cet animal.');
  }
  if (body.consultation_id) {
    const [consultations] = await pool.execute(
      'SELECT client_id, animal_id FROM consultations WHERE id = ? LIMIT 1', [body.consultation_id],
    );
    const consultation = consultations[0];
    if (!consultation || (body.client_id && Number(body.client_id) !== Number(consultation.client_id)) || (body.animal_id && Number(body.animal_id) !== Number(consultation.animal_id))) {
      throw new HttpError(422, 'La consultation ne correspond pas au dossier du document.');
    }
  }
  if (body.hospitalization_id) {
    const [hospitalizations] = await pool.execute(
      'SELECT client_id, animal_id FROM hospitalizations WHERE id = ? LIMIT 1', [body.hospitalization_id],
    );
    const hospitalization = hospitalizations[0];
    if (!hospitalization || (body.client_id && Number(body.client_id) !== Number(hospitalization.client_id)) || (body.animal_id && Number(body.animal_id) !== Number(hospitalization.animal_id))) {
      throw new HttpError(422, 'L’hospitalisation ne correspond pas au dossier du document.');
    }
  }
  const [result] = await pool.execute(
    `INSERT INTO documents
     (client_id, animal_id, consultation_id, hospitalization_id, category, file_name,
      storage_key, mime_type, size_bytes, description, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [body.client_id ?? null, body.animal_id ?? null, body.consultation_id ?? null,
      body.hospitalization_id ?? null, body.category, body.file_name, body.storage_key,
      body.mime_type, body.size_bytes, body.description ?? null, request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, ...body, uploaded_by: request.auth.id } });
}
