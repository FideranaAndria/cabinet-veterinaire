import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { archiveClient, createClient, getClient, listClients, updateClient } from './clients.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const nullableText = (max) => z.preprocess((value) => value === '' ? null : value, z.string().trim().max(max).nullable().optional());
const clientFields = {
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
 date_of_birth: z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    // Calcul de l'âge
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18; // Doit avoir 18 ans ou plus
  }, {
    message: "Le client doit être majeur (18 ans minimum) pour ouvrir un dossier."
  })
  .nullable()
  .optional(),
  sex: z.enum(['female', 'male', 'unknown']).optional(),
  sex: z.enum(['female', 'male', 'unknown']).optional(),
  email: z.preprocess((value) => value === '' ? null : value, z.string().trim().email().max(254).nullable().optional()),
  phone: nullableText(40),
  address_line: nullableText(255),
  postal_code: nullableText(20),
  city: nullableText(120),
  payment_method: nullableText(40),
  preferred_contact: z.enum(['email', 'phone', 'sms', 'none']).optional(),
  consent_personal_data: z.boolean().optional(),
  consent_marketing: z.boolean().optional(),
  notes: nullableText(5000),
};
const createSchema = z.object(clientFields).strict();
const updateSchema = z.object(clientFields).partial().strict().refine((data) => Object.keys(data).length > 0);
const listSchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const clientsRouter = Router();

clientsRouter.use(authenticate);
clientsRouter.get('/', requirePermission('clients.read'), validate(listSchema, 'query'), asyncHandler(listClients));
clientsRouter.post('/', requirePermission('clients.create'), validate(createSchema), asyncHandler(createClient));
clientsRouter.get('/:id', requirePermission('clients.read'), validate(idSchema, 'params'), asyncHandler(getClient));
clientsRouter.put('/:id', requirePermission('clients.update'), validate(idSchema, 'params'), validate(updateSchema), asyncHandler(updateClient));
clientsRouter.patch('/:id/archive', requirePermission('clients.archive'), validate(idSchema, 'params'), asyncHandler(archiveClient));