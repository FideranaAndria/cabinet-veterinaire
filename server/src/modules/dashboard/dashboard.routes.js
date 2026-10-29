import { Router } from 'express';
import { authenticate, requirePermission } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { getDashboardIndicators } from './dashboard.controller.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);
dashboardRouter.get('/indicators', requirePermission('dashboard.read'), asyncHandler(getDashboardIndicators));
