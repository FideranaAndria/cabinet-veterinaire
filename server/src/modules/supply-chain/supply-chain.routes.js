import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { createPurchaseOrder, createReturn, createSupplier, listLots, listPurchaseOrders, listReturns, listSuppliers, receivePurchaseOrder, updateReturnStatus, updateSupplier } from './supply-chain.controller.js';

const id = z.object({ id: z.coerce.number().int().positive() });
const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) };
const supplierFields = {
  name: z.string().trim().min(1).max(180), contact_name: z.string().trim().max(180).nullable().optional(),
  email: z.string().email().max(254).nullable().optional(), phone: z.string().trim().max(40).nullable().optional(),
  address: z.string().trim().max(3000).nullable().optional(), notes: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
};
const supplierCreate = z.object(supplierFields).strict();
const supplierUpdate = z.object(Object.fromEntries(Object.entries(supplierFields).map(([key, value]) => [key, value.optional()]))).strict().refine((value) => Object.keys(value).length > 0);
const orderSchema = z.object({
  supplier_id: z.coerce.number().int().positive(), order_number: z.string().trim().min(1).max(80),
  ordered_at: z.string().date(), expected_at: z.string().date().nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  lines: z.array(z.object({ product_id: z.coerce.number().int().positive(), quantity_ordered: z.coerce.number().int().positive(), unit_cost: z.coerce.number().min(0).max(1000000) }).strict()).min(1).max(100),
}).strict();
const receiveSchema = z.object({
  lines: z.array(z.object({ purchase_order_line_id: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive(), lot_number: z.string().trim().min(1).max(120), expires_on: z.string().date().nullable().optional() }).strict()).min(1).max(100),
}).strict();
const returnCreate = z.object({ supplier_id: z.coerce.number().int().positive(), product_id: z.coerce.number().int().positive(), lot_id: z.coerce.number().int().positive().nullable().optional(), quantity: z.coerce.number().int().positive(), reason: z.string().trim().min(1).max(1000) }).strict();
const returnStatus = z.object({ status: z.enum(['APPROVED', 'RETURNED', 'REJECTED']) }).strict();
const listQuery = z.object(page).strict();

export const supplyChainRouter = Router();
supplyChainRouter.use(authenticate);
supplyChainRouter.get('/suppliers', requirePermission('suppliers.read'), validate(listQuery, 'query'), asyncHandler(listSuppliers));
supplyChainRouter.post('/suppliers', requirePermission('suppliers.write'), validate(supplierCreate), asyncHandler(createSupplier));
supplyChainRouter.put('/suppliers/:id', requirePermission('suppliers.write'), validate(id, 'params'), validate(supplierUpdate), asyncHandler(updateSupplier));
supplyChainRouter.get('/purchase-orders', requirePermission('purchase_orders.read'), validate(listQuery, 'query'), asyncHandler(listPurchaseOrders));
supplyChainRouter.post('/purchase-orders', requirePermission('purchase_orders.write'), validate(orderSchema), asyncHandler(createPurchaseOrder));
supplyChainRouter.post('/purchase-orders/:id/receive', requirePermission('purchase_orders.write'), validate(id, 'params'), validate(receiveSchema), asyncHandler(receivePurchaseOrder));
supplyChainRouter.get('/lots', requirePermission('lots.read'), validate(listQuery, 'query'), asyncHandler(listLots));
supplyChainRouter.get('/returns', requirePermission('returns.read'), validate(listQuery, 'query'), asyncHandler(listReturns));
supplyChainRouter.post('/returns', requirePermission('returns.write'), validate(returnCreate), asyncHandler(createReturn));
supplyChainRouter.patch('/returns/:id/status', requirePermission('returns.write'), validate(id, 'params'), validate(returnStatus), asyncHandler(updateReturnStatus));
