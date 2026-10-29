import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { env } from '../src/config/env.js';
import { pool } from '../src/db/pool.js';

const { app } = await import('../src/app.js');

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function createUser(email, passwordHash, firstName, lastName, roleId) {
  const [result] = await pool.execute(
    'INSERT INTO users (email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?)',
    [email, passwordHash, firstName, lastName],
  );
  await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [result.insertId, roleId]);
  return result.insertId;
}

test('invoices can be created and paid', async () => {
  const suffix = randomUUID();
  const email = `billing-${suffix}@example.test`;
  const password = randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let adminId;
  const clientIds = [];
  const animalIds = [];
  const invoiceIds = [];

  try {
    const [roles] = await pool.execute('SELECT id, name FROM roles WHERE name IN (?, ?)', ['ADMIN', 'VETERINAIRE']);
    const roleIds = Object.fromEntries(roles.map((role) => [role.name, role.id]));
    assert.ok(roleIds.ADMIN && roleIds.VETERINAIRE, 'the migrations should seed clinical roles');
    adminId = await createUser(email, passwordHash, 'Billing', 'Test', roleIds.ADMIN);
    await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [adminId, roleIds.VETERINAIRE]);

    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    const token = login.body.data.accessToken;

    const clientResponse = await request(app).post('/api/v1/clients').set('Authorization', `Bearer ${token}`).send({
      first_name: 'Claire',
      last_name: 'Fournier',
      email: `${randomUUID()}@example.test`,
    });
    assert.equal(clientResponse.status, 201);
    clientIds.push(clientResponse.body.data.id);

    const animalResponse = await request(app).post('/api/v1/animals').set('Authorization', `Bearer ${token}`).send({
      name: 'Luna',
      species: 'Chien',
      client_ids: [clientIds[0]],
    });
    assert.equal(animalResponse.status, 201);
    animalIds.push(animalResponse.body.data.id);

    const invoice = await request(app).post('/api/v1/invoices').set('Authorization', `Bearer ${token}`).send({
      client_id: clientIds[0],
      animal_id: animalIds[0],
      issue_date: todayIso(),
      due_date: todayIso(),
      notes: 'Contrôle annuel',
      lines: [
        { description: 'Consultation', quantity: 1, unit_price: 85, vat_rate: 20 },
        { description: 'Vaccination', quantity: 1, unit_price: 45, vat_rate: 20 },
      ],
    });
    assert.equal(invoice.status, 201);
    assert.equal(invoice.body.data.total_amount, 156);
    assert.equal(invoice.body.data.status, 'DRAFT');
    invoiceIds.push(invoice.body.data.id);

    const payment = await request(app).post(`/api/v1/invoices/${invoice.body.data.id}/payments`).set('Authorization', `Bearer ${token}`).send({
      amount: 156,
      payment_method: 'CARD',
      paid_at: `${todayIso()}T10:00`,
    });
    assert.equal(payment.status, 201);
    assert.equal(payment.body.data.amount, 156);
    assert.equal(payment.body.data.invoice_status, 'PAID');
  } finally {
    for (const invoiceId of invoiceIds) {
      await pool.execute('DELETE FROM invoice_payments WHERE invoice_id = ?', [invoiceId]);
      await pool.execute('DELETE FROM invoice_lines WHERE invoice_id = ?', [invoiceId]);
      await pool.execute('DELETE FROM invoices WHERE id = ?', [invoiceId]);
    }

    for (const animalId of animalIds) {
      const [invoiceRows] = await pool.execute('SELECT id FROM invoices WHERE animal_id = ?', [animalId]);
      const invoiceIdsForAnimal = invoiceRows.map((row) => row.id);
      if (invoiceIdsForAnimal.length > 0) {
        await pool.execute('DELETE FROM invoice_payments WHERE invoice_id IN (?)', [invoiceIdsForAnimal]);
        await pool.execute('DELETE FROM invoice_lines WHERE invoice_id IN (?)', [invoiceIdsForAnimal]);
        await pool.execute('DELETE FROM invoices WHERE id IN (?)', [invoiceIdsForAnimal]);
      }

      await pool.execute('DELETE FROM client_animal WHERE animal_id = ?', [animalId]);
      await pool.execute('DELETE FROM animals WHERE id = ?', [animalId]);
    }

    for (const clientId of clientIds) {
      const [invoiceRows] = await pool.execute('SELECT id FROM invoices WHERE client_id = ?', [clientId]);
      const invoiceIdsForClient = invoiceRows.map((row) => row.id);
      if (invoiceIdsForClient.length > 0) {
        await pool.execute('DELETE FROM invoice_payments WHERE invoice_id IN (?)', [invoiceIdsForClient]);
        await pool.execute('DELETE FROM invoice_lines WHERE invoice_id IN (?)', [invoiceIdsForClient]);
        await pool.execute('DELETE FROM invoices WHERE id IN (?)', [invoiceIdsForClient]);
      }
      await pool.execute('DELETE FROM clients WHERE id = ?', [clientId]);
    }

    if (adminId) {
      await pool.execute('DELETE FROM user_sessions WHERE user_id = ?', [adminId]);
      await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [adminId]);
      await pool.execute('DELETE FROM users WHERE id = ?', [adminId]);
    }
    await pool.end();
  }
});
