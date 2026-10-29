import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-with-at-least-32-characters';

const { app } = await import('../src/app.js');

test('protected client records reject requests without a bearer token', async () => {
  const response = await request(app).get('/api/v1/clients');

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { success: false, message: 'Authentification requise.' });
});

test('protected medical records reject requests without a bearer token', async () => {
  const response = await request(app).get('/api/v1/medical-records/acts');

  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
});

test('login rejects invalid request data before accessing the database', async () => {
  const response = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });

  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Les données envoyées sont invalides.');
  assert.ok(Array.isArray(response.body.errors));
});