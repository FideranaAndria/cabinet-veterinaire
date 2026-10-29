import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { changePassword, login, logout } from './auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
}).strict();
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
  newPassword: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
}).strict();

export const authRouter = Router();

authRouter.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }), validate(loginSchema), asyncHandler(login));
authRouter.get('/me', authenticate, (request, response) => {
  const { sessionId: _sessionId, ...user } = request.auth;
  response.json({ success: true, data: { user } });
});
authRouter.post('/logout', authenticate, asyncHandler(logout));
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), asyncHandler(changePassword));