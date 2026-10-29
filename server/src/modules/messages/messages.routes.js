import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { listMessages, markMessageRead, sendMessage } from './messages.controller.js';

const id = z.object({ id: z.coerce.number().int().positive() });
const query = z.object({ folder: z.enum(['inbox', 'sent']).default('inbox'), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) }).strict();
const create = z.object({ recipient_id: z.coerce.number().int().positive(), subject: z.string().trim().min(1).max(180), content: z.string().trim().min(1).max(10000) }).strict();

export const messagesRouter = Router();
messagesRouter.use(authenticate);
messagesRouter.get('/', requirePermission('messages.read'), validate(query, 'query'), asyncHandler(listMessages));
messagesRouter.post('/', requirePermission('messages.create'), validate(create), asyncHandler(sendMessage));
messagesRouter.patch('/:id/read', requirePermission('messages.update'), validate(id, 'params'), asyncHandler(markMessageRead));
