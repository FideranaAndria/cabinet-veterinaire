import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { listAuditLogs } from './audit.controller.js';

const querySchema = z.object({
  entity_type: z.string().trim().max(120).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: 'La date de début doit précéder la date de fin.',
});

export const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.get('/', requirePermission('audit.read'), validate(querySchema, 'query'), asyncHandler(listAuditLogs));
