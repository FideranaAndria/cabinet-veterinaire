import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const querySchema = z.object({
  unread_only: z.enum(['true', 'false']).optional().default('false'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);
notificationsRouter.get('/', requirePermission('notifications.read'), validate(querySchema, 'query'), asyncHandler(listNotifications));
notificationsRouter.patch('/read-all', requirePermission('notifications.update'), asyncHandler(markAllNotificationsRead));
notificationsRouter.patch('/:id/read', requirePermission('notifications.update'), validate(idSchema, 'params'), asyncHandler(markNotificationRead));
