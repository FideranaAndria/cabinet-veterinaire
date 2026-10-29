import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { cancelPaymentRequest, createPaymentRequest, listPaymentRequests, recordPaymentRequestPayment } from './payment-requests.controller.js';

const id = z.object({ id: z.coerce.number().int().positive() });
const page = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), status: z.enum(['SENT', 'PAID', 'CANCELLED']).optional() }).strict();
const create = z.object({ invoice_id: z.coerce.number().int().positive(), request_number: z.string().trim().min(1).max(80), amount: z.coerce.number().positive().max(10000000), due_at: z.string().date().nullable().optional(), notes: z.string().trim().max(5000).nullable().optional() }).strict();
const payment = z.object({ payment_method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE']), paid_at: z.string().datetime({ offset: true }).optional(), notes: z.string().trim().max(1000).nullable().optional() }).strict();

export const paymentRequestsRouter = Router();
paymentRequestsRouter.use(authenticate);
paymentRequestsRouter.get('/', requirePermission('payment_requests.read'), validate(page, 'query'), asyncHandler(listPaymentRequests));
paymentRequestsRouter.post('/', requirePermission('payment_requests.create'), validate(create), asyncHandler(createPaymentRequest));
paymentRequestsRouter.post('/:id/pay', requirePermission('payment_requests.update'), validate(id, 'params'), validate(payment), asyncHandler(recordPaymentRequestPayment));
paymentRequestsRouter.post('/:id/cancel', requirePermission('payment_requests.update'), validate(id, 'params'), asyncHandler(cancelPaymentRequest));
