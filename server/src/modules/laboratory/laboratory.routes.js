import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createLaboratoryRequest, listLaboratoryRequests, updateLaboratoryRequest } from './laboratory.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const listSchema = z.object({
  animal_id: z.coerce.number().int().positive().optional(),
  client_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const createSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  animal_id: z.coerce.number().int().positive(),
  consultation_id: z.coerce.number().int().positive().nullable().optional(),
  veterinarian_id: z.coerce.number().int().positive(),
  analysis_type: z.string().trim().min(1).max(180),
  laboratory_name: z.string().trim().max(180).nullable().optional(),
  requested_at: z.string().datetime({ offset: true }).optional(),
}).strict();
const updateSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  laboratory_name: z.string().trim().max(180).nullable().optional(),
  result: z.string().trim().max(10000).nullable().optional(),
  document_reference: z.string().trim().max(500).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const laboratoryRouter = Router();
laboratoryRouter.use(authenticate);
laboratoryRouter.get('/', requirePermission('laboratory.read'), validate(listSchema, 'query'), asyncHandler(listLaboratoryRequests));
laboratoryRouter.post('/', requirePermission('laboratory.create'), validate(createSchema), asyncHandler(createLaboratoryRequest));
laboratoryRouter.patch('/:id', requirePermission('laboratory.update'), validate(idSchema, 'params'), validate(updateSchema), asyncHandler(updateLaboratoryRequest));
