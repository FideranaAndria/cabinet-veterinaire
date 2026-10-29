import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const { app } = await import('../src/app.js');

function localDayOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function createUser(email, passwordHash, firstName, lastName, roleId) {
  const [result] = await pool.execute(
    'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
    [email, passwordHash, firstName, lastName],
  );
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [result.insertId, roleId]);
  return result.insertId;
}

test('appointments prevent veterinarian/animal overlaps and consultations complete the visit', async () => {
  const suffix = randomUUID();
  const email = `schedule-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let adminId;
  let veterinarianId;
  const clientIds = [];
  const animalIds = [];
  const appointmentIds = [];
  const prescriptionIds = [];
  const vaccinationIds = [];
  const actIds = [];

  try {
    const [roles] = await pool.execute('SELECT id, name FROM roles WHERE name IN (?, ?)', ['ADMIN', 'VETERINAIRE']);
    const roleIds = Object.fromEntries(roles.map((role) => [role.name, role.id]));
    assert.ok(roleIds.ADMIN && roleIds.VETERINAIRE, 'the migrations should seed clinical roles');
    adminId = await createUser(email, passwordHash, 'Test', 'Agenda', roleIds.ADMIN);
    const secondVetEmail = `vet-${suffix}@example.test`;
    veterinarianId = await createUser(secondVetEmail, passwordHash, 'Vera', 'Test', roleIds.VETERINAIRE);
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [adminId, roleIds.VETERINAIRE]);

    for (const [firstName, lastName] of [['Lina', 'Martin'], ['Noé', 'Durand']]) {
      const response = await request(app).post('/api/v1/clients').send({
        first_name: firstName,
        last_name: lastName,
        email: `${randomUUID()}@example.test`,
      }).set('Authorization', `Bearer ${(await request(app).post('/api/v1/auth/login').send({ email, password })).body.data.accessToken}`);
      assert.equal(response.status, 201);
      clientIds.push(response.body.data.id);
    }

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    const token = login.body.data.accessToken;
    for (const [name, clientId] of [['Nala', clientIds[0]], ['Tao', clientIds[1]]]) {
      const response = await request(app).post('/api/v1/animals').set('Authorization', `Bearer ${token}`).send({
        name,
        species: 'Chat',
        client_ids: [clientId],
      });
      assert.equal(response.status, 201);
      animalIds.push(response.body.data.id);
    }

    const day = localDayOffset(1);
    const base = {
      client_id: clientIds[0],
      animal_id: animalIds[0],
      veterinarian_id: adminId,
      starts_at: `${day}T10:00`,
      ends_at: `${day}T10:30`,
      reason: 'Contrôle annuel',
    };
    const created = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send(base);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.starts_at, `${day}T10:00`);
    const appointmentId = created.body.data.id;
    appointmentIds.push(appointmentId);

    const vetConflict = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({
      ...base, client_id: clientIds[1], animal_id: animalIds[1], reason: 'Autre animal',
    });
    assert.equal(vetConflict.status, 409);
    assert.match(vetConflict.body.message, /vétérinaire/i);

    const concurrentBookings = await Promise.all([
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({
        ...base, animal_id: animalIds[0], starts_at: `${day}T12:00`, ends_at: `${day}T12:30`, reason: 'Créneau concurrent A',
      }),
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({
        ...base, client_id: clientIds[1], animal_id: animalIds[1], starts_at: `${day}T12:00`, ends_at: `${day}T12:30`, reason: 'Créneau concurrent B',
      }),
    ]);
    assert.deepEqual(concurrentBookings.map((response) => response.status).sort(), [201, 409]);
    appointmentIds.push(concurrentBookings.find((response) => response.status === 201).body.data.id);

    const animalConflict = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({
      ...base, veterinarian_id: veterinarianId, reason: 'Autre vétérinaire',
    });
    assert.equal(animalConflict.status, 409);
    assert.match(animalConflict.body.message, /animal/i);

    const adjacentSlot = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${token}`).send({
      ...base, starts_at: `${day}T10:30`, ends_at: `${day}T11:00`, reason: 'Créneau adjacent',
    });
    assert.equal(adjacentSlot.status, 201, 'back-to-back appointments should not conflict');
    appointmentIds.push(adjacentSlot.body.data.id);

    const confirmed = await request(app).patch(`/api/v1/appointments/${appointmentId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'CONFIRME' });
    assert.equal(confirmed.status, 200);
    const started = await request(app).patch(`/api/v1/appointments/${appointmentId}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'EN_COURS' });
    assert.equal(started.status, 200);

    const consultation = await request(app).post('/api/v1/consultations').set('Authorization', `Bearer ${token}`).send({
      appointment_id: appointmentId,
      clinical_exam: 'Examen général normal.',
      temperature_c: 38.5,
      heart_rate_bpm: 120,
      weight_kg: 4.2,
      diagnosis: 'Bon état général.',
      recommendations: 'Contrôle annuel dans douze mois.',
    });
    assert.equal(consultation.status, 201);
    const consultationId = consultation.body.data.id;
    assert.equal(consultation.body.data.animal_id, animalIds[0]);

    const finishedAppointment = await request(app).get(`/api/v1/appointments/${appointmentId}`).set('Authorization', `Bearer ${token}`);
    assert.equal(finishedAppointment.body.data.status, 'REALISE');
    assert.equal(finishedAppointment.body.data.consultation_id, consultationId);

    const history = await request(app).get('/api/v1/consultations').query({ animal_id: animalIds[0] }).set('Authorization', `Bearer ${token}`);
    assert.equal(history.status, 200);
    assert.ok(history.body.data.some((entry) => entry.id === consultationId));

    const act = await request(app).post('/api/v1/medical-records/acts').set('Authorization', `Bearer ${token}`).send({
      consultation_id: consultationId,
      act_type: 'medical',
      title: 'Examen buccal',
      description: 'Examen sans anomalie.',
    });
    assert.equal(act.status, 201);
    actIds.push(act.body.data.id);

    const prescription = await request(app).post('/api/v1/medical-records/prescriptions').set('Authorization', `Bearer ${token}`).send({
      consultation_id: consultationId,
      renewals_allowed: 1,
      items: [
        { medication_name: 'Traitement fictif A', dosage: '10 mg', route: 'orale', posology: 'Une prise le matin', duration_days: 5, quantity: 5 },
        { medication_name: 'Traitement fictif B', dosage: '1 ml', route: 'orale', posology: 'Une prise le soir', duration_days: 3, quantity: 3 },
      ],
    });
    assert.equal(prescription.status, 201);
    assert.equal(prescription.body.data.items.length, 2);
    prescriptionIds.push(prescription.body.data.id);

    const vaccination = await request(app).post('/api/v1/medical-records/vaccinations').set('Authorization', `Bearer ${token}`).send({
      consultation_id: consultationId,
      vaccine_type: 'Vaccin fictif',
      administered_at: day,
      batch_number: `LOT-${suffix.slice(0, 8)}`,
      next_due_at: localDayOffset(366),
    });
    assert.equal(vaccination.status, 201);
    vaccinationIds.push(vaccination.body.data.id);

    const actList = await request(app).get('/api/v1/medical-records/acts').query({ animal_id: animalIds[0] }).set('Authorization', `Bearer ${token}`);
    assert.ok(actList.body.data.some((entry) => entry.id === act.body.data.id));
    const prescriptionList = await request(app).get('/api/v1/medical-records/prescriptions').query({ animal_id: animalIds[0] }).set('Authorization', `Bearer ${token}`);
    assert.ok(prescriptionList.body.data.some((entry) => entry.id === prescription.body.data.id));
    const vaccinationList = await request(app).get('/api/v1/medical-records/vaccinations').query({ animal_id: animalIds[0] }).set('Authorization', `Bearer ${token}`);
    assert.ok(vaccinationList.body.data.some((entry) => entry.id === vaccination.body.data.id));

    const dispensed = await request(app).patch(`/api/v1/medical-records/prescriptions/${prescription.body.data.id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'dispensed' });
    assert.equal(dispensed.status, 200);
    assert.equal(dispensed.body.data.status, 'dispensed');
  } finally {
    for (const prescriptionId of prescriptionIds) await pool.execute('DELETE FROM prescription_items WHERE prescription_id = ?', [prescriptionId]);
    for (const prescriptionId of prescriptionIds) await pool.execute('DELETE FROM prescriptions WHERE id = ?', [prescriptionId]);
    for (const vaccinationId of vaccinationIds) await pool.execute('DELETE FROM vaccinations WHERE id = ?', [vaccinationId]);
    for (const actId of actIds) await pool.execute('DELETE FROM medical_acts WHERE id = ?', [actId]);
    if (appointmentIds.length > 0) {
      const placeholders = appointmentIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM consultations WHERE appointment_id IN (${placeholders})`, appointmentIds);
      await pool.execute(`DELETE FROM appointments WHERE id IN (${placeholders})`, appointmentIds);
    }
    for (const animalId of animalIds) {
      await pool.execute('DELETE FROM client_animal WHERE animal_id = ?', [animalId]);
      await pool.execute('DELETE FROM animals WHERE id = ?', [animalId]);
    }
    for (const clientId of clientIds) await pool.execute('DELETE FROM clients WHERE id = ?', [clientId]);
    for (const userId of [adminId, veterinarianId].filter(Boolean)) {
      await pool.execute('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
    await pool.end();
  }
});

test('hospitalizations support admission, follow-up and discharge workflows', async () => {
  const suffix = randomUUID();
  const email = `hospital-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let adminId;
  const clientIds = [];
  const animalIds = [];
  const hospitalizationIds = [];

  try {
    const [roles] = await pool.execute('SELECT id, name FROM roles WHERE name IN (?, ?)', ['ADMIN', 'VETERINAIRE']);
    const roleIds = Object.fromEntries(roles.map((role) => [role.name, role.id]));
    assert.ok(roleIds.ADMIN && roleIds.VETERINAIRE, 'the migrations should seed clinical roles');
    adminId = await createUser(email, passwordHash, 'Hôpital', 'Test', roleIds.ADMIN);
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [adminId, roleIds.VETERINAIRE]);

    const clientResponse = await request(app).post('/api/v1/clients').send({
      first_name: 'Milo',
      last_name: 'Hospital',
      email: `${randomUUID()}@example.test`,
    }).set('Authorization', `Bearer ${(await request(app).post('/api/v1/auth/login').send({ email, password })).body.data.accessToken}`);
    assert.equal(clientResponse.status, 201);
    clientIds.push(clientResponse.body.data.id);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    const token = login.body.data.accessToken;

    const animalResponse = await request(app).post('/api/v1/animals').set('Authorization', `Bearer ${token}`).send({
      name: 'Mimosa',
      species: 'Chien',
      client_ids: [clientIds[0]],
    });
    assert.equal(animalResponse.status, 201);
    animalIds.push(animalResponse.body.data.id);

    const admission = await request(app).post('/api/v1/hospitalizations').set('Authorization', `Bearer ${token}`).send({
      animal_id: animalIds[0],
      client_id: clientIds[0],
      veterinarian_id: adminId,
      ward_name: 'Unité soins intensifs',
      reason: 'Surveillance post-opératoire',
      status: 'ADMITTED',
      admitted_at: localDayOffset(0),
      expected_discharge_at: localDayOffset(2),
      notes: 'Observation et traitement en cours.',
    });
    assert.equal(admission.status, 201);
    assert.equal(admission.body.data.status, 'ADMITTED');
    hospitalizationIds.push(admission.body.data.id);

    const list = await request(app).get('/api/v1/hospitalizations').query({ animal_id: animalIds[0] }).set('Authorization', `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.ok(list.body.data.some((entry) => entry.id === admission.body.data.id));

    const discharge = await request(app).patch(`/api/v1/hospitalizations/${admission.body.data.id}/status`).set('Authorization', `Bearer ${token}`).send({
      status: 'DISCHARGED',
      discharge_notes: 'Sortie sous surveillance.',
    });
    assert.equal(discharge.status, 200);
    assert.equal(discharge.body.data.status, 'DISCHARGED');
  } finally {
    for (const hospitalizationId of hospitalizationIds) {
      await pool.execute('DELETE FROM hospitalization_follow_ups WHERE hospitalization_id = ?', [hospitalizationId]);
      await pool.execute('DELETE FROM hospitalizations WHERE id = ?', [hospitalizationId]);
    }
    for (const animalId of animalIds) {
      await pool.execute('DELETE FROM client_animal WHERE animal_id = ?', [animalId]);
      await pool.execute('DELETE FROM animals WHERE id = ?', [animalId]);
    }
    for (const clientId of clientIds) await pool.execute('DELETE FROM clients WHERE id = ?', [clientId]);
    if (adminId) {
      await pool.execute('DELETE FROM user_sessions WHERE user_id = ?', [adminId]);
      await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [adminId]);
      await pool.execute('DELETE FROM users WHERE id = ?', [adminId]);
    }
    await pool.end();
  }
});