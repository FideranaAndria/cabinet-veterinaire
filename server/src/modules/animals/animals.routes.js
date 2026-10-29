import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { archiveAnimal, createAnimal, getAnimal, listAnimals, updateAnimal } from './animals.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const nullableText = (max) => z.preprocess((value) => value === '' ? null : value, z.string().trim().max(max).nullable().optional());
const animalFields = {
  name: z.string().trim().min(1).max(120),
  species: z.string().trim().min(1).max(80),
  breed: nullableText(120),
  sex: z.enum(['female', 'male', 'unknown']).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  microchip_number: nullableText(50),
  tattoo_number: nullableText(50),
  icad_number: nullableText(50),
  color: nullableText(80),
  weight_kg: z.coerce.number().positive().max(1000).nullable().optional(),
  body_condition_score: z.coerce.number().int().min(1).max(9).nullable().optional(),
  notes: nullableText(5000),
  medical_history: nullableText(5000),
  allergies: nullableText(5000),
  pathologies: nullableText(5000),
  current_treatments: nullableText(5000),
  status: z.enum(['active', 'deceased', 'archived']).optional(),
  deceased_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  death_reason: nullableText(2000),
};
const createSchema = z.object({
  ...animalFields,
  client_ids: z.array(z.coerce.number().int().positive()).min(1).max(10),
}).strict();
const updateSchema = z.object({
  ...Object.fromEntries(Object.entries(animalFields).map(([key, value]) => [key, value.optional()])),
  client_ids: z.array(z.coerce.number().int().positive()).min(1).max(10).optional(),
}).strict().refine((data) => Object.keys(data).length > 0);
const listSchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const animalsRouter = Router();

animalsRouter.use(authenticate);
animalsRouter.get('/', requirePermission('animals.read'), validate(listSchema, 'query'), asyncHandler(listAnimals));
animalsRouter.post('/', requirePermission('animals.create'), validate(createSchema), asyncHandler(createAnimal));
animalsRouter.get('/:id', requirePermission('animals.read'), validate(idSchema, 'params'), asyncHandler(getAnimal));
animalsRouter.put('/:id', requirePermission('animals.update'), validate(idSchema, 'params'), validate(updateSchema), asyncHandler(updateAnimal));
animalsRouter.patch('/:id/archive', requirePermission('animals.archive'), validate(idSchema, 'params'), asyncHandler(archiveAnimal));