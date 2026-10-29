import { Router } from 'express';
import { pool } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

healthRouter.get('/ready', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1');
    response.status(200).json({ status: 'ready' });
  } catch (error) {
    next(error);
  }
});
