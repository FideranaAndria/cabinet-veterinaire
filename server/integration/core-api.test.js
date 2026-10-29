import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const { app } = await import('../src/app.js');

test('authenticated client and animal workflow persists and revokes access', async () => {
  const email = `integration-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const newPassword = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let userId;
  const clientIds = [];
  let animalId;

  try {
    const [userResult] = await pool.execute(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
      [email, passwordHash, 'Test', 'Integration'],
    );
    userId = userResult.insertId;
    const [adminRoles] = await pool.execute('SELECT id FROM roles WHERE name = ?', ['ADMIN']);
    assert.equal(adminRoles.length, 1, 'database migrations should seed the ADMIN role');
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, adminRoles[0].id]);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    assert.ok(login.body.data.accessToken);
    const token = login.body.data.accessToken;

    for (const [firstName, lastName] of [['Aline', 'Martin'], ['Noé', 'Durand']]) {
      const response = await request(app)
        .post('/api/v1/clients')
        .set('Authorization', `Bearer ${token}`)
        .send({ first_name: firstName, last_name: lastName, email: `${randomUUID()}@example.test` });
      assert.equal(response.status, 201);
      clientIds.push(response.body.data.id);
    }

    const createdAnimal = await request(app)
      .post('/api/v1/animals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Moka', species: 'Chat', sex: 'female', client_ids: [clientIds[0]] });
    assert.equal(createdAnimal.status, 201);
    animalId = createdAnimal.body.data.id;
    assert.equal(createdAnimal.body.data.owners[0].id, clientIds[0]);

    const changedOwners = await request(app)
      .put(`/api/v1/animals/${animalId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ client_ids: [clientIds[1]] });
    assert.equal(changedOwners.status, 200);
    assert.equal(changedOwners.body.data.owners[0].id, clientIds[1]);

    const [history] = await pool.execute(
      'SELECT valid_to FROM client_animal WHERE animal_id = ? AND client_id = ? ORDER BY id',
      [animalId, clientIds[0]],
    );
    assert.equal(history.length, 1);
    assert.ok(history[0].valid_to, 'previous ownership should remain as closed history');

    const archive = await request(app)
      .patch(`/api/v1/animals/${animalId}/archive`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(archive.status, 200);

    const passwordChange = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword });
    assert.equal(passwordChange.status, 200);

    const oldSession = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    assert.equal(oldSession.status, 401);
    const oldPasswordLogin = await request(app).post('/api/v1/auth/login').send({ email, password });
    assert.equal(oldPasswordLogin.status, 401);

    const newLogin = await request(app).post('/api/v1/auth/login').send({ email, password: newPassword });
    assert.equal(newLogin.status, 200);
    const logout = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${newLogin.body.data.accessToken}`);
    assert.equal(logout.status, 200);
    const revokedAccess = await request(app).get('/api/v1/clients').set('Authorization', `Bearer ${newLogin.body.data.accessToken}`);
    assert.equal(revokedAccess.status, 401);
  } finally {
    if (animalId) await pool.execute('DELETE FROM client_animal WHERE animal_id = ?', [animalId]);
    if (clientIds.length > 0) {
      const placeholders = clientIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM client_animal WHERE client_id IN (${placeholders})`, clientIds);
    }
    if (animalId) await pool.execute('DELETE FROM animals WHERE id = ?', [animalId]);
    for (const clientId of clientIds) await pool.execute('DELETE FROM clients WHERE id = ?', [clientId]);
    if (userId) {
      await pool.execute('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
    await pool.end();
  }
});