import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createAppointment, getAppointment, listAppointments, listVeterinarians, updateAppointment, updateAppointmentStatus } from './appointments.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine((value) => !Number.isNaN(new Date(value).getTime()));
const nullableText = z.preprocess((value) => value === '' ? null : value, z.string().trim().max(3000).nullable().optional());
const appointmentFields = {
  client_id: z.coerce.number().int().positive(),
  animal_id: z.coerce.number().int().positive(),
  veterinarian_id: z.coerce.number().int().positive(),
  starts_at: localDateTime,
  ends_at: localDateTime,
  reason: z.string().trim().min(1).max(255),
  is_emergency: z.boolean().optional().default(false),
  notes: nullableText,
};
const validInterval = (data) => new Date(data.ends_at) > new Date(data.starts_at);
const createSchema = z.object(appointmentFields).strict().refine(validInterval, { message: 'La fin doit être postérieure au début.', path: ['ends_at'] });
const updateFields = Object.fromEntries(Object.entries(appointmentFields).map(([key, value]) => [key, value.optional()]));
const updateSchema = z.object(updateFields).strict()
  .refine((data) => Object.keys(data).length > 0, { message: 'Au moins un champ doit être modifié.' })
  .refine((data) => !(data.starts_at && !data.ends_at) && !(!data.starts_at && data.ends_at), { message: 'Le début et la fin doivent être modifiés ensemble.' })
  .refine((data) => !data.starts_at || validInterval(data), { message: 'La fin doit être postérieure au début.', path: ['ends_at'] });
const statusSchema = z.object({ status: z.enum(['PLANIFIE', 'CONFIRME', 'EN_COURS', 'REALISE', 'ANNULE', 'REPORTE']) }).strict();
const listSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['PLANIFIE', 'CONFIRME', 'EN_COURS', 'REALISE', 'ANNULE', 'REPORTE']).optional(),
  veterinarian_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
}).strict().refine((data) => !data.from || !data.to || data.to >= data.from, { message: 'La période est invalide.' });

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate);
appointmentsRouter.get('/veterinarians', requirePermission('appointments.read'), asyncHandler(listVeterinarians));
appointmentsRouter.get('/', requirePermission('appointments.read'), validate(listSchema, 'query'), asyncHandler(listAppointments));
appointmentsRouter.post('/', requirePermission('appointments.create'), validate(createSchema), asyncHandler(createAppointment));
appointmentsRouter.get('/:id', requirePermission('appointments.read'), validate(idSchema, 'params'), asyncHandler(getAppointment));
appointmentsRouter.put('/:id', requirePermission('appointments.update'), validate(idSchema, 'params'), validate(updateSchema), asyncHandler(updateAppointment));
appointmentsRouter.patch('/:id/status', requirePermission('appointments.status'), validate(idSchema, 'params'), validate(statusSchema), asyncHandler(updateAppointmentStatus));