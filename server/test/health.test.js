import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-with-at-least-32-characters';

const { app } = await import('../src/app.js');

test('GET /api/v1/health reports that the API is available', async () => {
  const response = await request(app).get('/api/v1/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('unknown routes return a safe JSON error', async () => {
  const response = await request(app).get('/api/v1/not-a-route');

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { success: false, message: 'Route not found' });
  assert.equal('stack' in response.body, false);
});
