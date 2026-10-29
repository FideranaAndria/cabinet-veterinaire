import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createDocument, listDocuments } from './documents.controller.js';

const listSchema = z.object({
  client_id: z.coerce.number().int().positive().optional(),
  animal_id: z.coerce.number().int().positive().optional(),
  category: z.enum(['MEDICAL', 'ADMINISTRATIVE', 'LABORATORY', 'BILLING', 'OTHER']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const createSchema = z.object({
  client_id: z.coerce.number().int().positive().nullable().optional(),
  animal_id: z.coerce.number().int().positive().nullable().optional(),
  consultation_id: z.coerce.number().int().positive().nullable().optional(),
  hospitalization_id: z.coerce.number().int().positive().nullable().optional(),
  category: z.enum(['MEDICAL', 'ADMINISTRATIVE', 'LABORATORY', 'BILLING', 'OTHER']).optional().default('OTHER'),
  file_name: z.string().trim().min(1).max(255),
  storage_key: z.string().trim().min(1).max(500).regex(/^[A-Za-z0-9/_-]+$/),
  mime_type: z.string().trim().min(1).max(120),
  size_bytes: z.coerce.number().int().positive().max(52428800),
  description: z.string().trim().max(1000).nullable().optional(),
}).strict().refine((document) => document.client_id || document.animal_id || document.consultation_id || document.hospitalization_id, {
  message: 'Le document doit être rattaché à un dossier.',
});

export const documentsRouter = Router();
documentsRouter.use(authenticate);
documentsRouter.get('/', requirePermission('documents.read'), validate(listSchema, 'query'), asyncHandler(listDocuments));
documentsRouter.post('/', requirePermission('documents.create'), validate(createSchema), asyncHandler(createDocument));
