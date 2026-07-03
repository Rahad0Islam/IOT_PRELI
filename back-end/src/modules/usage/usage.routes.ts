/**
 * modules/usage/usage.routes.ts
 */

import { Router } from 'express';
import { usageController } from './usage.controller.js';

const router = Router();

router.get('/', usageController.snapshot);

export const usageRoutes = router;
