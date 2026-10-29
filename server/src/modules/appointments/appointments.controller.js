import { pool } from '../../db/pool.js';
import { HttpError } from '../../utils/http-error.js';

const busyStatuses = ['PLANIFIE', 'CONFIRME', 'EN_COURS'];

function sqlDateTime(value) {
  return value.replace('T', ' ') + ':00';
}

async function findAppointment(id, executor = pool) {
  const [rows] = await executor.execute(
    `SELECT appointments.id, appointments.client_id, appointments.animal_id, appointments.veterinarian_id,
            DATE_FORMAT(appointments.starts_at, '%Y-%m-%dT%H:%i') AS starts_at,
            DATE_FORMAT(appointments.ends_at, '%Y-%m-%dT%H:%i') AS ends_at,
            appointments.reason, appointments.status,
            appointments.is_emergency, appointments.notes, appointments.created_at, appointments.updated_at,
            clients.client_number, clients.first_name AS client_first_name, clients.last_name AS client_last_name,
            animals.name AS animal_name, animals.species AS animal_species,
            users.first_name AS veterinarian_first_name, users.last_name AS veterinarian_last_name,
            consultations.id AS consultation_id
     FROM appointments
     JOIN clients ON clients.id = appointments.client_id
     JOIN animals ON animals.id = appointments.animal_id
     JOIN users ON users.id = appointments.veterinarian_id
     LEFT JOIN consultations ON consultations.appointment_id = appointments.id
     WHERE appointments.id = ? LIMIT 1`,
    [id],
  );
  return rows[0];
}

export async function listVeterinarians(_request, response) {
  const [rows] = await pool.execute(
    `SELECT users.id, users.first_name, users.last_name
     FROM users
     JOIN user_roles ON user_roles.user_id = users.id
     JOIN roles ON roles.id = user_roles.role_id
     WHERE users.is_active = TRUE AND roles.name = 'VETERINAIRE'
     ORDER BY users.last_name, users.first_name`,
  );
  response.json({ success: true, data: rows });
}

export async function listAppointments(request, response) {
  const { from, to, status, veterinarian_id: veterinarianId, search, page, pageSize } = request.query;
  const conditions = [];
  const values = [];
  if (from) { conditions.push('appointments.starts_at >= ?'); values.push(`${from} 00:00:00`); }
  if (to) { conditions.push('appointments.starts_at < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(`${to} 00:00:00`); }
  if (status) { conditions.push('appointments.status = ?'); values.push(status); }
  if (veterinarianId) { conditions.push('appointments.veterinarian_id = ?'); values.push(veterinarianId); }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push('(clients.first_name LIKE ? OR clients.last_name LIKE ? OR animals.name LIKE ? OR appointments.reason LIKE ?)');
    values.push(pattern, pattern, pattern, pattern);
  }
  const filter = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;
  const joins = `FROM appointments
    JOIN clients ON clients.id = appointments.client_id
    JOIN animals ON animals.id = appointments.animal_id
    JOIN users ON users.id = appointments.veterinarian_id`;
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total ${joins} ${filter}`, values);
  const [rows] = await pool.execute(
        `SELECT appointments.id,
          DATE_FORMAT(appointments.starts_at, '%Y-%m-%dT%H:%i') AS starts_at,
          DATE_FORMAT(appointments.ends_at, '%Y-%m-%dT%H:%i') AS ends_at,
          appointments.reason,
            appointments.status, appointments.is_emergency, appointments.client_id, appointments.animal_id,
            appointments.veterinarian_id, clients.client_number, clients.first_name AS client_first_name,
            clients.last_name AS client_last_name, animals.name AS animal_name, animals.species AS animal_species,
            users.first_name AS veterinarian_first_name, users.last_name AS veterinarian_last_name,
            consultations.id AS consultation_id
     ${joins} LEFT JOIN consultations ON consultations.appointment_id = appointments.id
     ${filter}
     ORDER BY appointments.starts_at LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );
  response.json({ success: true, data: rows, pagination: { page, pageSize, total: countRows[0].total, totalPages: Math.ceil(countRows[0].total / pageSize) } });
}

export async function getAppointment(request, response) {
  const appointment = await findAppointment(request.params.id);
  if (!appointment) throw new HttpError(404, 'Rendez-vous introuvable.');
  response.json({ success: true, data: appointment });
}

async function lockAndValidateResources(connection, appointment) {
  const [veterinarians] = await connection.execute(
    `SELECT users.id FROM users
     WHERE users.id = ? AND users.is_active = TRUE
       AND EXISTS (
         SELECT 1 FROM user_roles
         JOIN roles ON roles.id = user_roles.role_id
         WHERE user_roles.user_id = users.id AND roles.name = 'VETERINAIRE'
       )
     FOR UPDATE`,
    [appointment.veterinarian_id],
  );
  if (veterinarians.length === 0) throw new HttpError(422, 'Le vétérinaire sélectionné est introuvable ou inactif.');

  const [animals] = await connection.execute(
    'SELECT id FROM animals WHERE id = ? AND deleted_at IS NULL AND status = \'active\' FOR UPDATE',
    [appointment.animal_id],
  );
  if (animals.length === 0) throw new HttpError(422, 'L’animal sélectionné est introuvable ou archivé.');

  const [owners] = await connection.execute(
    `SELECT clients.id FROM clients
     JOIN client_animal ON client_animal.client_id = clients.id
     WHERE clients.id = ? AND clients.deleted_at IS NULL AND clients.status = 'active'
       AND client_animal.animal_id = ? AND client_animal.valid_to IS NULL
     LIMIT 1`,
    [appointment.client_id, appointment.animal_id],
  );
  if (owners.length === 0) throw new HttpError(422, 'Ce client n’est pas propriétaire actif de l’animal sélectionné.');
}

async function assertNoConflict(connection, appointment, excludedId = null) {
  const [conflicts] = await connection.execute(
    `SELECT id,
       CASE WHEN veterinarian_id = ? THEN 'veterinarian' ELSE 'animal' END AS conflict_type
     FROM appointments
     WHERE status IN ('PLANIFIE', 'CONFIRME', 'EN_COURS')
       AND (veterinarian_id = ? OR animal_id = ?)
       AND starts_at < ? AND ends_at > ?
       AND (? IS NULL OR id <> ?)
     LIMIT 1`,
    [appointment.veterinarian_id, appointment.veterinarian_id, appointment.animal_id,
      appointment.ends_at, appointment.starts_at, excludedId, excludedId],
  );
  if (conflicts.length > 0) {
    const message = conflicts[0].conflict_type === 'veterinarian'
      ? 'Ce vétérinaire a déjà un rendez-vous sur ce créneau.'
      : 'Cet animal a déjà un rendez-vous sur ce créneau.';
    throw new HttpError(409, message);
  }
}

async function inTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createAppointment(request, response) {
  const appointment = { ...request.body, starts_at: sqlDateTime(request.body.starts_at), ends_at: sqlDateTime(request.body.ends_at) };
  const id = await inTransaction(async (connection) => {
    await lockAndValidateResources(connection, appointment);
    await assertNoConflict(connection, appointment);
    const [result] = await connection.execute(
      `INSERT INTO appointments
       (client_id, animal_id, veterinarian_id, starts_at, ends_at, reason, is_emergency, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [appointment.client_id, appointment.animal_id, appointment.veterinarian_id, appointment.starts_at,
        appointment.ends_at, appointment.reason, appointment.is_emergency ?? false,
        appointment.notes ?? null, request.auth.id],
    );
    await connection.execute(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       VALUES (?, 'appointment.created', 'Nouveau rendez-vous', ?, 'appointments', ?)`,
      [appointment.veterinarian_id, `Un rendez-vous est prévu le ${appointment.starts_at}.`, String(result.insertId)],
    );
    return result.insertId;
  });
  response.status(201).json({ success: true, data: await findAppointment(id) });
}

export async function updateAppointment(request, response) {
  const { id } = request.params;
  const updated = await inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [id]);
    const current = rows[0];
    if (!current) throw new HttpError(404, 'Rendez-vous introuvable.');
    if (!busyStatuses.includes(current.status)) throw new HttpError(409, 'Un rendez-vous terminé ou annulé ne peut plus être modifié.');

    const appointment = {
      client_id: request.body.client_id ?? current.client_id,
      animal_id: request.body.animal_id ?? current.animal_id,
      veterinarian_id: request.body.veterinarian_id ?? current.veterinarian_id,
      starts_at: request.body.starts_at ? sqlDateTime(request.body.starts_at) : current.starts_at,
      ends_at: request.body.ends_at ? sqlDateTime(request.body.ends_at) : current.ends_at,
      reason: request.body.reason ?? current.reason,
      is_emergency: request.body.is_emergency ?? current.is_emergency,
      notes: request.body.notes === undefined ? current.notes : request.body.notes,
    };
    if (new Date(appointment.ends_at) <= new Date(appointment.starts_at)) throw new HttpError(422, 'La fin doit être postérieure au début.');
    await lockAndValidateResources(connection, appointment);
    await assertNoConflict(connection, appointment, Number(id));
    await connection.execute(
      `UPDATE appointments SET client_id = ?, animal_id = ?, veterinarian_id = ?, starts_at = ?, ends_at = ?, reason = ?, is_emergency = ?, notes = ?, status = ?
       WHERE id = ?`,
      [appointment.client_id, appointment.animal_id, appointment.veterinarian_id, appointment.starts_at,
        appointment.ends_at, appointment.reason, appointment.is_emergency, appointment.notes,
        current.status === 'REPORTE' ? 'PLANIFIE' : current.status, id],
    );
    await connection.execute(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       VALUES (?, 'appointment.updated', 'Rendez-vous modifié', ?, 'appointments', ?)`,
      [appointment.veterinarian_id, `Le rendez-vous n°${id} a été modifié.`, String(id)],
    );
    return Number(id);
  });
  response.json({ success: true, data: await findAppointment(updated) });
}

export async function updateAppointmentStatus(request, response) {
  const { id } = request.params;
  const status = request.body.status;
  await inTransaction(async (connection) => {
    const [rows] = await connection.execute('SELECT status FROM appointments WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw new HttpError(404, 'Rendez-vous introuvable.');
    const transitions = {
      PLANIFIE: ['CONFIRME', 'ANNULE', 'REPORTE'],
      CONFIRME: ['EN_COURS', 'ANNULE', 'REPORTE'],
      EN_COURS: ['ANNULE'],
      REPORTE: ['PLANIFIE', 'ANNULE'],
      REALISE: [],
      ANNULE: [],
    };
    if (!transitions[rows[0].status].includes(status)) throw new HttpError(409, 'Cette transition de statut est interdite.');
    await connection.execute('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);
  });
  response.json({ success: true, data: await findAppointment(id) });
}
