import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createInvoice,
  createInvoicePayment,
  getInvoice,
  listInvoices,
  cancelInvoice,
  createInvoiceFromConsultation,
  listServicePrices,
} from './invoices.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(255),
  quantity: z.coerce.number().gt(0),
  unit_price: z.coerce.number().min(0),
  vat_rate: z.coerce.number().min(0).max(100).default(0),
}).strict();
const createSchema = z.object({
  client_id: z.coerce.number().int().positive(),
  animal_id: z.coerce.number().int().positive(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  lines: z.array(invoiceLineSchema).min(1).max(50),
}).strict();
const paymentSchema = z.object({
  amount: z.coerce.number().gt(0),
  payment_method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
}).strict();
const listSchema = z.object({
  client_id: z.coerce.number().int().positive().optional(),
  animal_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'OVERDUE']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
const consultationParamSchema = z.object({ consultationId: z.coerce.number().int().positive() });

// Schéma pour valider les lignes envoyées depuis une consultation
const consultationInvoiceSchema = z.object({
  lines: z.array(invoiceLineSchema).min(1, "Au moins une ligne est requise"),
}).strict();

export const invoicesRouter = Router();

invoicesRouter.use(authenticate);

// Liste et création
invoicesRouter.get('/', requirePermission('invoices.read'), validate(listSchema, 'query'), asyncHandler(listInvoices));
invoicesRouter.post('/', requirePermission('invoices.create'), validate(createSchema), asyncHandler(createInvoice));

// Tarifs (doit être AVANT /:id)
invoicesRouter.get('/services/prices', requirePermission('invoices.read'), asyncHandler(listServicePrices));

// Créer depuis une consultation (doit être AVANT /:id)
invoicesRouter.post(
  '/from-consultation/:consultationId',
  requirePermission('invoices.create'),
  validate(consultationParamSchema, 'params'),       // Valide l'ID dans l'URL
  validate(consultationInvoiceSchema),               // Valide les lignes dans le body
  asyncHandler(createInvoiceFromConsultation),
);

// Détail et actions sur une facture
invoicesRouter.get('/:id', requirePermission('invoices.read'), validate(idSchema, 'params'), asyncHandler(getInvoice));
invoicesRouter.post('/:id/payments', requirePermission('invoices.payments.create'), validate(idSchema, 'params'), validate(paymentSchema), asyncHandler(createInvoicePayment));
invoicesRouter.post('/:id/cancel', requirePermission('invoices.update'), validate(idSchema, 'params'), asyncHandler(cancelInvoice));