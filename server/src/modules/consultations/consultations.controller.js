import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const clinicalFields = [
  'reason', 'clinical_exam', 'temperature_c', 'heart_rate_bpm', 'respiratory_rate_bpm',
  'weight_kg', 'observations', 'diagnosis', 'recommendations', 'follow_up_at',
];

function sqlDateTime(value) {
  return value ? value.replace('T', ' ') + ':00' : null;
}

async function findConsultation(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT consultations.id, consultations.appointment_id, consultations.client_id,
            consultations.animal_id, consultations.veterinarian_id, consultations.consulted_at,
            consultations.reason, consultations.clinical_exam, consultations.temperature_c,
            consultations.heart_rate_bpm, consultations.respiratory_rate_bpm, consultations.weight_kg,
            consultations.observations, consultations.diagnosis, consultations.recommendations,
            consultations.follow_up_at, consultations.created_at, consultations.updated_at,
            animals.name AS animal_name, animals.species AS animal_species,
            clients.first_name AS client_first_name, clients.last_name AS client_last_name,
            users.first_name AS veterinarian_first_name, users.last_name AS veterinarian_last_name
     FROM consultations
     JOIN animals ON animals.id = consultations.animal_id
     JOIN clients ON clients.id = consultations.client_id
     JOIN users ON users.id = consultations.veterinarian_id
     WHERE consultations.id = ? LIMIT 1`,
    [id],
  );
  return rows[0];
}

export async function listConsultations(request, response) {
  const { animal_id: animalId, client_id: clientId, from, to, page, pageSize } = request.query;
  const conditions = [];
  const values = [];
  if (animalId) { conditions.push('consultations.animal_id = ?'); values.push(animalId); }
  if (clientId) { conditions.push('consultations.client_id = ?'); values.push(clientId); }
  if (from) { conditions.push('consultations.consulted_at >= ?'); values.push(`${from} 00:00:00`); }
  if (to) { conditions.push('consultations.consulted_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(`${to} 00:00:00`); }
  const filter = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const joins = `FROM consultations JOIN animals ON animals.id = consultations.animal_id
    JOIN clients ON clients.id = consultations.client_id JOIN users ON users.id = consultations.veterinarian_id`;
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total ${joins} ${filter}`, values);
  const [rows] = await pool.execute(
    `SELECT consultations.id, consultations.appointment_id, consultations.animal_id,
            consultations.client_id, consultations.veterinarian_id, consultations.consulted_at,
            consultations.reason, consultations.diagnosis, animals.name AS animal_name,
            animals.species AS animal_species, clients.first_name AS client_first_name,
            clients.last_name AS client_last_name, users.first_name AS veterinarian_first_name,
            users.last_name AS veterinarian_last_name
     ${joins} ${filter} ORDER BY consultations.consulted_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) } });
}

export async function getConsultation(request, response) {
  const consultation = await findConsultation(request.params.id);
  if (!consultation) throw new HttpError(404, 'Consultation introuvable.');
  response.json({ success: true, data: consultation });
}

export async function createConsultation(request, response) {
  const connection = await pool.getConnection();
  let consultationId;
  try {
    await connection.beginTransaction();
    const [appointments] = await connection.execute(
      `SELECT id, client_id, animal_id, veterinarian_id, starts_at, reason, status
       FROM appointments WHERE id = ? FOR UPDATE`,
      [request.body.appointment_id],
    );
    const appointment = appointments[0];
    if (!appointment) throw new HttpError(404, 'Rendez-vous introuvable.');
    if (appointment.status !== 'EN_COURS') throw new HttpError(409, 'Démarrez le rendez-vous avant de saisir la consultation.');

    const [result] = await connection.execute(
      `INSERT INTO consultations
       (appointment_id, client_id, animal_id, veterinarian_id, consulted_at, reason, clinical_exam,
        temperature_c, heart_rate_bpm, respiratory_rate_bpm, weight_kg, observations, diagnosis,
        recommendations, follow_up_at, created_by)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [request.body.appointment_id, appointment.client_id, appointment.animal_id, appointment.veterinarian_id,
        request.body.reason ?? appointment.reason, request.body.clinical_exam ?? null,
        request.body.temperature_c ?? null, request.body.heart_rate_bpm ?? null,
        request.body.respiratory_rate_bpm ?? null, request.body.weight_kg ?? null,
        request.body.observations ?? null, request.body.diagnosis ?? null,
        request.body.recommendations ?? null, sqlDateTime(request.body.follow_up_at), request.auth.id],
    );
    consultationId = result.insertId;
    await connection.execute('UPDATE appointments SET status = \'REALISE\' WHERE id = ?', [appointment.id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Une consultation existe déjà pour ce rendez-vous.');
    throw error;
  } finally {
    connection.release();
  }

  response.status(201).json({ success: true, data: await findConsultation(consultationId) });
}

export async function updateConsultation(request, response) {
  const { id } = request.params;
  const consultation = await findConsultation(id);
  if (!consultation) throw new HttpError(404, 'Consultation introuvable.');
  const fields = Object.keys(request.body).filter((field) => clinicalFields.includes(field));
  const values = fields.map((field) => field === 'follow_up_at' ? sqlDateTime(request.body[field]) : request.body[field]);
  await pool.execute(
    `UPDATE consultations SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
    [...values, id],
  );
  response.json({ success: true, data: await findConsultation(id) });
}