import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const hospitalizationStatuses = ['ADMITTED', 'OBSERVATION', 'DISCHARGED', 'CANCELLED'];

function sqlDateTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return raw.includes('T') ? `${raw.replace('T', ' ')}:00` : `${raw} 00:00:00`;
}

async function validateVeterinarian(connection, veterinarianId) {
  const [rows] = await connection.execute(
    `SELECT users.id
     FROM users
     JOIN user_roles ON user_roles.user_id = users.id
     JOIN roles ON roles.id = user_roles.role_id
     WHERE users.id = ? AND users.is_active = TRUE AND roles.name = 'VETERINAIRE'
     LIMIT 1`,
    [veterinarianId],
  );
  if (rows.length === 0) throw new HttpError(422, 'Le vétérinaire sélectionné est introuvable ou inactif.');
}

async function validateAnimalClient(connection, animalId, clientId) {
  const [animalRows] = await connection.execute(
    'SELECT id FROM animals WHERE id = ? AND deleted_at IS NULL AND status = ? LIMIT 1',
    [animalId, 'active'],
  );
  if (animalRows.length === 0) throw new HttpError(422, 'L’animal sélectionné est introuvable ou archivé.');

  const [ownerRows] = await connection.execute(
    `SELECT client_animal.client_id
     FROM client_animal
     WHERE client_animal.animal_id = ?
       AND client_animal.client_id = ?
       AND client_animal.valid_to IS NULL
     LIMIT 1`,
    [animalId, clientId],
  );
  if (ownerRows.length === 0) throw new HttpError(422, 'Ce client n’est pas propriétaire actif de l’animal sélectionné.');
}

async function findHospitalization(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT hospitalizations.id,
            hospitalizations.animal_id,
            hospitalizations.client_id,
            hospitalizations.veterinarian_id,
            hospitalizations.ward_name,
            hospitalizations.reason,
            hospitalizations.status,
            DATE_FORMAT(hospitalizations.admitted_at, '%Y-%m-%dT%H:%i') AS admitted_at,
            DATE_FORMAT(hospitalizations.expected_discharge_at, '%Y-%m-%dT%H:%i') AS expected_discharge_at,
            DATE_FORMAT(hospitalizations.discharged_at, '%Y-%m-%dT%H:%i') AS discharged_at,
            hospitalizations.notes,
            hospitalizations.discharge_notes,
            hospitalizations.created_at,
            hospitalizations.updated_at,
            animals.name AS animal_name,
            clients.first_name AS client_first_name,
            clients.last_name AS client_last_name,
            users.first_name AS veterinarian_first_name,
            users.last_name AS veterinarian_last_name
     FROM hospitalizations
     JOIN animals ON animals.id = hospitalizations.animal_id
     JOIN clients ON clients.id = hospitalizations.client_id
     JOIN users ON users.id = hospitalizations.veterinarian_id
     WHERE hospitalizations.id = ? LIMIT 1`,
    [id],
  );
  if (rows.length === 0) return null;

  const [followUps] = await executor.execute(
    `SELECT id, hospitalization_id, created_by, title, notes, vital_signs, care_plan, next_step,
            DATE_FORMAT(recorded_at, '%Y-%m-%dT%H:%i') AS recorded_at
     FROM hospitalization_follow_ups
     WHERE hospitalization_id = ?
     ORDER BY recorded_at DESC, id DESC`,
    [id],
  );

  return { ...rows[0], follow_ups: followUps };
}

export async function listHospitalizations(request, response) {
  const { animal_id: animalId, client_id: clientId, status, page, pageSize } = request.query;
  const conditions = [];
  const values = [];
  if (animalId) { conditions.push('hospitalizations.animal_id = ?'); values.push(animalId); }
  if (clientId) { conditions.push('hospitalizations.client_id = ?'); values.push(clientId); }
  if (status) { conditions.push('hospitalizations.status = ?'); values.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM hospitalizations ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT hospitalizations.id,
            hospitalizations.animal_id,
            hospitalizations.client_id,
            hospitalizations.veterinarian_id,
            hospitalizations.ward_name,
            hospitalizations.reason,
            hospitalizations.status,
            DATE_FORMAT(hospitalizations.admitted_at, '%Y-%m-%dT%H:%i') AS admitted_at,
            DATE_FORMAT(hospitalizations.expected_discharge_at, '%Y-%m-%dT%H:%i') AS expected_discharge_at,
            DATE_FORMAT(hospitalizations.discharged_at, '%Y-%m-%dT%H:%i') AS discharged_at,
            animals.name AS animal_name,
            clients.first_name AS client_first_name,
            clients.last_name AS client_last_name
     FROM hospitalizations
     JOIN animals ON animals.id = hospitalizations.animal_id
     JOIN clients ON clients.id = hospitalizations.client_id
     ${where}
     ORDER BY hospitalizations.admitted_at DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );

  response.json({
    success: true,
    data: rows,
    pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) },
  });
}

export async function getHospitalization(request, response) {
  const hospitalization = await findHospitalization(request.params.id);
  if (!hospitalization) throw new HttpError(404, 'Hospitalisation introuvable.');
  response.json({ success: true, data: hospitalization });
}

export async function createHospitalization(request, response) {
  const payload = {
    ...request.body,
    admitted_at: sqlDateTime(request.body.admitted_at ?? new Date().toISOString()),
    expected_discharge_at: sqlDateTime(request.body.expected_discharge_at ?? null),
    status: request.body.status ?? 'ADMITTED',
  };

  if (!hospitalizationStatuses.includes(payload.status)) {
    throw new HttpError(422, 'Le statut d’hospitalisation est invalide.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await validateVeterinarian(connection, payload.veterinarian_id);
    await validateAnimalClient(connection, payload.animal_id, payload.client_id);
    const [result] = await connection.execute(
      `INSERT INTO hospitalizations (
        animal_id, client_id, veterinarian_id, ward_name, reason, status,
        admitted_at, expected_discharge_at, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.animal_id,
        payload.client_id,
        payload.veterinarian_id,
        payload.ward_name,
        payload.reason,
        payload.status,
        payload.admitted_at,
        payload.expected_discharge_at,
        payload.notes ?? null,
        request.auth.id,
      ],
    );
    await connection.commit();
    response.status(201).json({ success: true, data: await findHospitalization(result.insertId) });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateHospitalizationStatus(request, response) {
  const { status, discharge_notes } = request.body;
  const [rows] = await pool.execute('SELECT status, discharged_at FROM hospitalizations WHERE id = ? LIMIT 1', [request.params.id]);
  if (rows.length === 0) throw new HttpError(404, 'Hospitalisation introuvable.');

  const currentStatus = rows[0].status;
  const transitions = {
    ADMITTED: ['OBSERVATION', 'DISCHARGED', 'CANCELLED'],
    OBSERVATION: ['DISCHARGED', 'CANCELLED'],
    DISCHARGED: [],
    CANCELLED: [],
  };

  if (!transitions[currentStatus]?.includes(status)) {
    throw new HttpError(409, 'Cette transition de statut est interdite.');
  }

  if (!hospitalizationStatuses.includes(status)) {
    throw new HttpError(422, 'Le statut d’hospitalisation est invalide.');
  }

  await pool.execute(
    `UPDATE hospitalizations
     SET status = ?, discharge_notes = ?, discharged_at = CASE WHEN ? = 'DISCHARGED' THEN CURRENT_TIMESTAMP ELSE discharged_at END
     WHERE id = ?`,
    [status, discharge_notes ?? null, status, request.params.id],
  );

  response.json({ success: true, data: await findHospitalization(request.params.id) });
}

export async function createHospitalizationFollowUp(request, response) {
  const [rows] = await pool.execute('SELECT id FROM hospitalizations WHERE id = ? LIMIT 1', [request.params.id]);
  if (rows.length === 0) throw new HttpError(404, 'Hospitalisation introuvable.');

  const { title, notes, vital_signs, care_plan, next_step } = request.body;
  const [result] = await pool.execute(
    `INSERT INTO hospitalization_follow_ups (hospitalization_id, created_by, title, notes, vital_signs, care_plan, next_step)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [request.params.id, request.auth.id, title, notes ?? null, vital_signs ?? null, care_plan ?? null, next_step ?? null],
  );

  response.status(201).json({ success: true, data: { id: result.insertId, hospitalization_id: request.params.id } });
}
