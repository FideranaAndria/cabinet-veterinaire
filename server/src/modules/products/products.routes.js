import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  createProduct,
  createStockMovement,
  getProduct,
  listInventory,
  listProducts,
  updateProduct,
} from './products.controller.js';

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const nullableText = (max) => z.preprocess((value) => value === '' ? null : value, z.string().trim().max(max).nullable().optional());
const productFields = {
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(120),
  description: nullableText(5000),
  unit: z.string().trim().min(1).max(40).default('unité'),
  purchase_price: z.coerce.number().min(0).max(1000000).nullable().optional(),
  sale_price: z.coerce.number().min(0).max(1000000).nullable().optional(),
  stock_quantity: z.coerce.number().int().min(0).default(0),
  stock_alert_threshold: z.coerce.number().int().min(0).default(0),
  status: z.enum(['active', 'discontinued']).optional().default('active'),
};
const createSchema = z.object(productFields).strict();
const updateSchema = z.object(Object.fromEntries(Object.entries(productFields).map(([key, value]) => [key, value.optional()]))).strict().refine((data) => Object.keys(data).length > 0);
const stockMovementSchema = z.object({
  movement_type: z.enum(['ENTRY', 'EXIT', 'ADJUSTMENT']),
  quantity: z.coerce.number().int().refine((value) => value !== 0, { message: 'La quantité doit être non nulle.' }),
  unit_cost: z.coerce.number().min(0).max(1000000).nullable().optional(),
  reason: z.string().trim().max(255).nullable().optional(),
}).strict();
const listSchema = z.object({
  search: z.string().trim().max(120).optional().default(''),
  category: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'discontinued']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const productsRouter = Router();

productsRouter.use(authenticate);
productsRouter.get('/', requirePermission('products.read'), validate(listSchema, 'query'), asyncHandler(listProducts));
productsRouter.post('/', requirePermission('products.create'), validate(createSchema), asyncHandler(createProduct));
productsRouter.get('/inventory', requirePermission('inventory.read'), asyncHandler(listInventory));
productsRouter.get('/:id', requirePermission('products.read'), validate(idSchema, 'params'), asyncHandler(getProduct));
productsRouter.put('/:id', requirePermission('products.update'), validate(idSchema, 'params'), validate(updateSchema), asyncHandler(updateProduct));
productsRouter.post('/:id/stock-movements', requirePermission('inventory.write'), validate(idSchema, 'params'), validate(stockMovementSchema), asyncHandler(createStockMovement));
