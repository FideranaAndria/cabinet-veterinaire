import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createHospitalization,
  createHospitalizationFollowUp,
  getHospitalization,
  listHospitalizations,
  updateHospitalizationStatus,
} from './hospitalizations.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const nullableText = (max) => z.preprocess((value) => value === '' ? null : value, z.string().trim().max(max).nullable().optional());
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).refine((value) => !Number.isNaN(new Date(value.replace('T', ' ')).getTime()));
const listSchema = z.object({
  animal_id: z.coerce.number().int().positive().optional(),
  client_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['ADMITTED', 'OBSERVATION', 'DISCHARGED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const createSchema = z.object({
  animal_id: z.coerce.number().int().positive(),
  client_id: z.coerce.number().int().positive(),
  veterinarian_id: z.coerce.number().int().positive(),
  ward_name: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1).max(3000),
  status: z.enum(['ADMITTED', 'OBSERVATION', 'CANCELLED']).optional().default('ADMITTED'),
  admitted_at: localDateTime.optional(),
  expected_discharge_at: localDateTime.optional(),
  notes: nullableText(5000),
}).strict();
const statusSchema = z.object({
  status: z.enum(['ADMITTED', 'OBSERVATION', 'DISCHARGED', 'CANCELLED']),
  discharge_notes: z.string().trim().max(5000).optional(),
}).strict();
const followUpSchema = z.object({
  title: z.string().trim().min(1).max(180),
  notes: z.string().trim().max(5000).optional(),
  vital_signs: z.string().trim().max(2000).optional(),
  care_plan: z.string().trim().max(2000).optional(),
  next_step: z.string().trim().max(2000).optional(),
}).strict();

export const hospitalizationsRouter = Router();

hospitalizationsRouter.use(authenticate);
hospitalizationsRouter.get('/', requirePermission('hospitalizations.read'), validate(listSchema, 'query'), asyncHandler(listHospitalizations));
hospitalizationsRouter.post('/', requirePermission('hospitalizations.create'), validate(createSchema), asyncHandler(createHospitalization));
hospitalizationsRouter.get('/:id', requirePermission('hospitalizations.read'), validate(idSchema, 'params'), asyncHandler(getHospitalization));
hospitalizationsRouter.patch('/:id/status', requirePermission('hospitalizations.update'), validate(idSchema, 'params'), validate(statusSchema), asyncHandler(updateHospitalizationStatus));
hospitalizationsRouter.post('/:id/follow-ups', requirePermission('hospitalizations.update'), validate(idSchema, 'params'), validate(followUpSchema), asyncHandler(createHospitalizationFollowUp));
