import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createConsultation, getConsultation, listConsultations, updateConsultation } from './consultations.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const nullableText = (max) => z.preprocess((value) => value === '' ? null : value, z.string().trim().max(max).nullable().optional());
const fields = {
  reason: z.string().trim().min(1).max(255).optional(),
  clinical_exam: nullableText(10000),
  temperature_c: z.coerce.number().min(20).max(50).nullable().optional(),
  heart_rate_bpm: z.coerce.number().int().positive().max(1000).nullable().optional(),
  respiratory_rate_bpm: z.coerce.number().int().positive().max(1000).nullable().optional(),
  weight_kg: z.coerce.number().positive().max(1000).nullable().optional(),
  observations: nullableText(10000),
  diagnosis: nullableText(10000),
  recommendations: nullableText(10000),
  follow_up_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().optional(),
};
const createSchema = z.object({ appointment_id: z.coerce.number().int().positive(), ...fields }).strict();
const updateSchema = z.object(fields).strict().refine((data) => Object.keys(data).length > 0);
const listSchema = z.object({
  animal_id: z.coerce.number().int().positive().optional(),
  client_id: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const consultationsRouter = Router();

consultationsRouter.use(authenticate);
consultationsRouter.get('/', requirePermission('consultations.read'), validate(listSchema, 'query'), asyncHandler(listConsultations));
consultationsRouter.post('/', requirePermission('consultations.create'), validate(createSchema), asyncHandler(createConsultation));
consultationsRouter.get('/:id', requirePermission('consultations.read'), validate(idSchema, 'params'), asyncHandler(getConsultation));
consultationsRouter.put('/:id', requirePermission('consultations.update'), validate(idSchema, 'params'), validate(updateSchema), asyncHandler(updateConsultation));