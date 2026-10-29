import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createClaim, createPolicy, listClaims, listPolicies, updateClaimStatus } from './insurance.controller.js';

const id = z.object({ id: z.coerce.number().int().positive() });
const page = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), status: z.string().max(20).optional() }).strict();
const policy = z.object({
  client_id: z.coerce.number().int().positive(), animal_id: z.coerce.number().int().positive(),
  insurer_name: z.string().trim().min(1).max(180), policy_number: z.string().trim().min(1).max(120),
  coverage_type: z.string().trim().max(120).nullable().optional(), coverage_limit: z.coerce.number().min(0).nullable().optional(),
  valid_from: z.string().date(), valid_until: z.string().date().nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(),
}).strict();
const claim = z.object({ policy_id: z.coerce.number().int().positive(), invoice_id: z.coerce.number().int().positive().nullable().optional(), consultation_id: z.coerce.number().int().positive().nullable().optional(), claim_number: z.string().trim().min(1).max(120), amount: z.coerce.number().positive().max(10000000), reason: z.string().trim().min(1).max(5000) }).strict();
const claimStatus = z.object({ status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED']), decision_notes: z.string().trim().max(5000).nullable().optional() }).strict();

export const insuranceRouter = Router();
insuranceRouter.use(authenticate);
insuranceRouter.get('/policies', requirePermission('insurance.read'), validate(page, 'query'), asyncHandler(listPolicies));
insuranceRouter.post('/policies', requirePermission('insurance.write'), validate(policy), asyncHandler(createPolicy));
insuranceRouter.get('/claims', requirePermission('insurance.read'), validate(page, 'query'), asyncHandler(listClaims));
insuranceRouter.post('/claims', requirePermission('insurance.write'), validate(claim), asyncHandler(createClaim));
insuranceRouter.patch('/claims/:id/status', requirePermission('insurance.write'), validate(id, 'params'), validate(claimStatus), asyncHandler(updateClaimStatus));
