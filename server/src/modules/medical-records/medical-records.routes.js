import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createMedicalAct, createPrescription, createVaccination, getPrescription,
  listMedicalActs, listPrescriptions, listVaccinations, updateMedicalAct,
  updatePrescriptionStatus, updateVaccination,
} from './medical-records.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const nullableText = (max) => z.preprocess((value) => value === '' ? null : value, z.string().trim().max(max).nullable().optional());
const listSchema = z.object({
  animal_id: z.coerce.number().int().positive().optional(),
  consultation_id: z.coerce.number().int().positive().optional(),
  from: date.optional(),
  to: date.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine((data) => !data.from || !data.to || data.to >= data.from, { message: 'La période est invalide.' });

const actSchema = z.object({
  consultation_id: z.coerce.number().int().positive(),
  act_type: z.enum(['medical', 'surgical']),
  title: z.string().trim().min(1).max(180),
  performed_at: dateTime.optional(),
  description: nullableText(10000),
  anesthesia_protocol: nullableText(10000),
  materials_used: nullableText(10000),
  complications: nullableText(10000),
  report: nullableText(10000),
  follow_up_at: dateTime.nullable().optional(),
}).strict();
const actUpdateSchema = actSchema.omit({ consultation_id: true }).partial().strict().refine((data) => Object.keys(data).length > 0);

const prescriptionItemSchema = z.object({
  medication_name: z.string().trim().min(1).max(180),
  dosage: z.string().trim().min(1).max(160),
  route: nullableText(80),
  posology: z.string().trim().min(1).max(500),
  duration_days: z.preprocess((value) => value === null || value === '' ? null : value, z.coerce.number().int().positive().max(3650).nullable().optional()),
  quantity: z.preprocess((value) => value === null || value === '' ? null : value, z.coerce.number().positive().max(100000).nullable().optional()),
  instructions: nullableText(3000),
}).strict();
const prescriptionSchema = z.object({
  consultation_id: z.coerce.number().int().positive(),
  valid_until: date.nullable().optional(),
  renewals_allowed: z.coerce.number().int().min(0).max(12).optional().default(0),
  observations: nullableText(5000),
  items: z.array(prescriptionItemSchema).min(1).max(30),
}).strict();
const prescriptionStatusSchema = z.object({ status: z.enum(['dispensed', 'expired', 'cancelled']) }).strict();

const vaccinationBaseSchema = z.object({
  consultation_id: z.coerce.number().int().positive(),
  vaccine_type: z.string().trim().min(1).max(160),
  administered_at: date,
  batch_number: nullableText(80),
  next_due_at: date.nullable().optional(),
  reaction: nullableText(5000),
  certificate_reference: nullableText(255),
}).strict();
const vaccinationSchema = vaccinationBaseSchema.refine((data) => !data.next_due_at || data.next_due_at >= data.administered_at, { message: 'Le rappel doit être postérieur à l’injection.', path: ['next_due_at'] });
const vaccinationUpdateSchema = vaccinationBaseSchema.omit({ consultation_id: true }).partial().strict()
  .refine((data) => Object.keys(data).length > 0)
  .refine((data) => !data.next_due_at || !data.administered_at || data.next_due_at >= data.administered_at, { message: 'Le rappel doit être postérieur à l’injection.', path: ['next_due_at'] });

export const medicalRecordsRouter = Router();
medicalRecordsRouter.use(authenticate);

medicalRecordsRouter.get('/acts', requirePermission('medical_acts.read'), validate(listSchema, 'query'), asyncHandler(listMedicalActs));
medicalRecordsRouter.post('/acts', requirePermission('medical_acts.create'), validate(actSchema), asyncHandler(createMedicalAct));
medicalRecordsRouter.put('/acts/:id', requirePermission('medical_acts.update'), validate(idSchema, 'params'), validate(actUpdateSchema), asyncHandler(updateMedicalAct));

medicalRecordsRouter.get('/prescriptions', requirePermission('prescriptions.read'), validate(listSchema, 'query'), asyncHandler(listPrescriptions));
medicalRecordsRouter.post('/prescriptions', requirePermission('prescriptions.create'), validate(prescriptionSchema), asyncHandler(createPrescription));
medicalRecordsRouter.get('/prescriptions/:id', requirePermission('prescriptions.read'), validate(idSchema, 'params'), asyncHandler(getPrescription));
medicalRecordsRouter.patch('/prescriptions/:id/status', requirePermission('prescriptions.update'), validate(idSchema, 'params'), validate(prescriptionStatusSchema), asyncHandler(updatePrescriptionStatus));

medicalRecordsRouter.get('/vaccinations', requirePermission('vaccinations.read'), validate(listSchema, 'query'), asyncHandler(listVaccinations));
medicalRecordsRouter.post('/vaccinations', requirePermission('vaccinations.create'), validate(vaccinationSchema), asyncHandler(createVaccination));
medicalRecordsRouter.put('/vaccinations/:id', requirePermission('vaccinations.update'), validate(idSchema, 'params'), validate(vaccinationUpdateSchema), asyncHandler(updateVaccination));