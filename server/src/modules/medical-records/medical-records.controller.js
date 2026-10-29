import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const actFields = ['act_type', 'title', 'performed_at', 'description', 'anesthesia_protocol', 'materials_used', 'complications', 'report', 'follow_up_at'];
const vaccinationFields = ['vaccine_type', 'administered_at', 'batch_number', 'next_due_at', 'reaction', 'certificate_reference'];

function sqlDateTime(value) {
  return value ? value.replace('T', ' ') + ':00' : null;
}

async function consultationContext(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT id, client_id, animal_id, veterinarian_id FROM consultations WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!rows[0]) throw new HttpError(404, 'Consultation introuvable.');
  return rows[0];
}

function filterQuery(query, dateColumn) {
  const conditions = [];
  const values = [];
  if (query.animal_id) { conditions.push('animal_id = ?'); values.push(query.animal_id); }
  if (query.consultation_id) { conditions.push('consultation_id = ?'); values.push(query.consultation_id); }
  if (query.from) { conditions.push(`${dateColumn} >= ?`); values.push(`${query.from} 00:00:00`); }
  if (query.to) { conditions.push(`${dateColumn} < DATE_ADD(?, INTERVAL 1 DAY)`); values.push(`${query.to} 00:00:00`); }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', values };
}

async function listRecords(request, response, table, columns, dateColumn) {
  const { page, pageSize } = request.query;
  const { where, values } = filterQuery(request.query, dateColumn);
  const offset = (page - 1) * pageSize;
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM ${table} ${where}`, values);
  const [rows] = await pool.execute(
    `SELECT ${columns} FROM ${table} ${where} ORDER BY ${dateColumn} DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) } });
}

export async function listMedicalActs(request, response) {
  return listRecords(
    request, response, 'medical_acts',
    'id, consultation_id, client_id, animal_id, veterinarian_id, act_type, title, performed_at, description, anesthesia_protocol, materials_used, complications, report, follow_up_at',
    'performed_at',
  );
}

export async function createMedicalAct(request, response) {
  const consultation = await consultationContext(request.body.consultation_id);
  const fields = Object.keys(request.body).filter((field) => actFields.includes(field));
  const values = fields.map((field) => ['performed_at', 'follow_up_at'].includes(field) ? sqlDateTime(request.body[field]) : request.body[field]);
  const [result] = await pool.execute(
    `INSERT INTO medical_acts (consultation_id, client_id, animal_id, veterinarian_id, ${fields.join(', ')}, created_by)
     VALUES (?, ?, ?, ?, ${fields.map(() => '?').join(', ')}, ?)`,
    [consultation.id, consultation.client_id, consultation.animal_id, consultation.veterinarian_id, ...values, request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, consultation_id: consultation.id, animal_id: consultation.animal_id } });
}

export async function updateMedicalAct(request, response) {
  const fields = Object.keys(request.body).filter((field) => actFields.includes(field));
  const values = fields.map((field) => ['performed_at', 'follow_up_at'].includes(field) ? sqlDateTime(request.body[field]) : request.body[field]);
  const [result] = await pool.execute(
    `UPDATE medical_acts SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
    [...values, request.params.id],
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.execute('SELECT id FROM medical_acts WHERE id = ?', [request.params.id]);
    if (rows.length === 0) throw new HttpError(404, 'Act médical introuvable.');
  }
  response.json({ success: true, message: 'Acte médical mis à jour.' });
}

export async function listPrescriptions(request, response) {
  return listRecords(
    request, response, 'prescriptions',
    `id, consultation_id, client_id, animal_id, veterinarian_id, issued_at, valid_until,
     renewals_allowed, status, observations,
     (SELECT GROUP_CONCAT(medication_name ORDER BY id SEPARATOR ', ')
      FROM prescription_items WHERE prescription_id = prescriptions.id) AS medications`,
    'issued_at',
  );
}

export async function createPrescription(request, response) {
  const connection = await pool.getConnection();
  let prescriptionId;
  try {
    await connection.beginTransaction();
    const consultation = await consultationContext(request.body.consultation_id, connection);
    const [result] = await connection.execute(
      `INSERT INTO prescriptions (consultation_id, client_id, animal_id, veterinarian_id, valid_until, renewals_allowed, observations, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [consultation.id, consultation.client_id, consultation.animal_id, consultation.veterinarian_id,
        request.body.valid_until ?? null, request.body.renewals_allowed, request.body.observations ?? null, request.auth.id],
    );
    prescriptionId = result.insertId;
    for (const item of request.body.items) {
      await connection.execute(
        `INSERT INTO prescription_items (prescription_id, medication_name, dosage, route, posology, duration_days, quantity, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [prescriptionId, item.medication_name, item.dosage, item.route ?? null, item.posology,
          item.duration_days ?? null, item.quantity ?? null, item.instructions ?? null],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  response.status(201).json({ success: true, data: await getPrescriptionRecord(prescriptionId) });
}

async function getPrescriptionRecord(id, executor = pool) {
  const [prescriptions] = await executor.execute(
    `SELECT id, consultation_id, client_id, animal_id, veterinarian_id, issued_at, valid_until,
            renewals_allowed, status, observations, created_at
     FROM prescriptions WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!prescriptions[0]) return null;
  const [items] = await executor.execute(
    `SELECT id, medication_name, dosage, route, posology, duration_days, quantity, instructions
     FROM prescription_items WHERE prescription_id = ? ORDER BY id`,
    [id],
  );
  return { ...prescriptions[0], items };
}

export async function getPrescription(request, response) {
  const prescription = await getPrescriptionRecord(request.params.id);
  if (!prescription) throw new HttpError(404, 'Ordonnance introuvable.');
  response.json({ success: true, data: prescription });
}

export async function updatePrescriptionStatus(request, response) {
  const [rows] = await pool.execute('SELECT status FROM prescriptions WHERE id = ? LIMIT 1', [request.params.id]);
  if (rows.length === 0) throw new HttpError(404, 'Ordonnance introuvable.');
  const transitions = { active: ['dispensed', 'expired', 'cancelled'], dispensed: [], expired: [], cancelled: [] };
  if (!transitions[rows[0].status].includes(request.body.status)) throw new HttpError(409, 'Cette transition de statut est interdite.');
  await pool.execute('UPDATE prescriptions SET status = ? WHERE id = ?', [request.body.status, request.params.id]);
  response.json({ success: true, data: await getPrescriptionRecord(request.params.id) });
}

export async function listVaccinations(request, response) {
  return listRecords(
    request, response, 'vaccinations',
    'id, consultation_id, client_id, animal_id, veterinarian_id, vaccine_type, administered_at, batch_number, next_due_at, reaction, certificate_reference',
    'administered_at',
  );
}

export async function createVaccination(request, response) {
  const consultation = await consultationContext(request.body.consultation_id);
  const fields = Object.keys(request.body).filter((field) => vaccinationFields.includes(field));
  const [result] = await pool.execute(
    `INSERT INTO vaccinations (consultation_id, client_id, animal_id, veterinarian_id, ${fields.join(', ')}, created_by)
     VALUES (?, ?, ?, ?, ${fields.map(() => '?').join(', ')}, ?)`,
    [consultation.id, consultation.client_id, consultation.animal_id, consultation.veterinarian_id,
      ...fields.map((field) => request.body[field] ?? null), request.auth.id],
  );
  response.status(201).json({ success: true, data: { id: result.insertId, consultation_id: consultation.id, animal_id: consultation.animal_id } });
}

export async function updateVaccination(request, response) {
  const [existing] = await pool.execute('SELECT administered_at FROM vaccinations WHERE id = ? LIMIT 1', [request.params.id]);
  if (existing.length === 0) throw new HttpError(404, 'Vaccination introuvable.');
  const administeredAt = request.body.administered_at ?? existing[0].administered_at;
  if (request.body.next_due_at && new Date(request.body.next_due_at) < new Date(administeredAt)) {
    throw new HttpError(422, 'Le rappel doit être postérieur à l’injection.');
  }
  const fields = Object.keys(request.body).filter((field) => vaccinationFields.includes(field));
  const [result] = await pool.execute(
    `UPDATE vaccinations SET ${fields.map((field) => `${field} = ?`).join(', ')} WHERE id = ?`,
    [...fields.map((field) => request.body[field] ?? null), request.params.id],
  );
  if (result.affectedRows === 0) return response.json({ success: true, message: 'Aucune modification nécessaire.' });
  response.json({ success: true, message: 'Vaccination mise à jour.' });
}