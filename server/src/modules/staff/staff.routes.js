import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createStaffProfile, listStaffProfiles, updateStaffProfile } from './staff.controller.js';

const id = z.object({ id: z.coerce.number().int().positive() });
const page = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), staff_type: z.enum(['VETERINARIAN', 'VET_ASSISTANT', 'ASV', 'ADMINISTRATIVE', 'LABORATORY']).optional() }).strict();
const fields = {
  user_id: z.coerce.number().int().positive(), staff_number: z.string().trim().min(1).max(40),
  staff_type: z.enum(['VETERINARIAN', 'VET_ASSISTANT', 'ASV', 'ADMINISTRATIVE', 'LABORATORY']),
  specialty: z.string().trim().max(180).nullable().optional(), qualification: z.string().trim().max(255).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(), hired_on: z.string().date().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(), notes: z.string().trim().max(5000).nullable().optional(),
};
const createSchema = z.object(fields).strict();
const updateSchema = z.object(Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'user_id').map(([key, value]) => [key, value.optional()]))).strict().refine((value) => Object.keys(value).length > 0);

export const staffRouter = Router();
staffRouter.use(authenticate);
staffRouter.get('/', requirePermission('staff.read'), validate(page, 'query'), asyncHandler(listStaffProfiles));
staffRouter.post('/', requirePermission('staff.write'), validate(createSchema), asyncHandler(createStaffProfile));
staffRouter.put('/:id', requirePermission('staff.write'), validate(id, 'params'), validate(updateSchema), asyncHandler(updateStaffProfile));
